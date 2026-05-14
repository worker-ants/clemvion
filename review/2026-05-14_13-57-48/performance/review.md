### 발견사항

---

**[CRITICAL] `handleInstall`이 시스템 전체 pending 통합을 메모리로 적재 후 인메모리 필터링**
- 위치: `integration-oauth.service.ts` — `handleInstall()`, L~655
- 상세: `.getMany()`가 `cafe24` + `pending_install` 조건만으로 전체 DB를 스캔한다. `mall_id`는 암호화된 JSONB `credentials` 안에 있어 SQL 레벨에서 추가 필터가 불가능하기 때문에, 모든 후보 행을 가져와 디크립트한 뒤 루프에서 걸러낸다. pending 통합이 많을수록 디크립션 비용이 O(n)으로 증가하며, limit 없는 `getMany()`는 행 수에 상한이 없다.
- 제안: 이미 마이그레이션에 `install_token` 컬럼이 추가되어 있다. `handleInstall` 시점에 `mall_id` + `install_token`을 쿼리 파라미터로 노출하거나(App URL에 token을 포함시켜 전달), 또는 `mall_id`를 암호화하지 않는 별도 컬럼으로 분리하면 단일 인덱스 조회로 전환할 수 있다.

---

**[CRITICAL] `verifyHmac`가 후보마다 `rawQuery`를 반복 파싱**
- 위치: `integration-oauth.service.ts` — `handleInstall()` 내 루프 + `verifyHmac()` 함수
- 상세: `rawQuery`는 요청당 고정값임에도, `verifyHmac`는 매 호출마다 `new URLSearchParams(rawQuery)` 파싱 → `sort` → `encodeURIComponent` 직렬화 → HMAC 계산을 반복한다. 후보 n명이면 O(n × m) (m = 쿼리 파라미터 수).
- 제안: 루프 진입 전 message 문자열을 한 번만 구성해 재사용한다. HMAC secret만 후보별로 교체하면 된다.
  ```typescript
  // 루프 밖에서 한 번만
  const params = new URLSearchParams(rawQuery);
  params.delete('hmac');
  const message = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

  for (const candidate of candidates) {
    const secret = candidate.credentials.client_secret as string;
    const computed = createHmac('sha256', secret).update(message, 'utf8').digest('base64');
    if (timingSafeEqual(Buffer.from(computed), Buffer.from(receivedHmac))) { ... }
  }
  ```

---

**[WARNING] `install_token`이 생성되지만 조회에 활용되지 않음**
- 위치: `integration-oauth.service.ts` — `createPrivatePendingIntegration()` L~635 vs `handleInstall()` L~655
- 상세: `randomBytes(32).toString('hex')`로 `installToken`을 생성하고 DB에 저장하지만, `handleInstall`에서 후보 조회 쿼리에 사용하지 않는다. 이 토큰은 `appUrl` 응답에도 포함되지 않아 실질적으로 활용처가 없다. 토큰을 App URL 쿼리 파라미터(`?token=...`)에 포함시키고 DB 인덱스 조회에 쓰면 전체 스캔을 단일 행 lookup으로 전환할 수 있다.
- 제안:
  ```typescript
  // appUrl에 token 포함
  appUrl: `${appUrl}/api/integrations/oauth/install/cafe24?token=${installToken}`,

  // handleInstall에서 인덱스 조회
  const target = await this.integrationRepository.findOne({
    where: { installToken: query.token, status: 'pending_install' }
  });
  // 이후 HMAC으로 2차 검증
  ```
  `install_token` 컬럼에 인덱스가 없으므로 추가 필요.

---

**[WARNING] SQL 마이그레이션 — `DROP CONSTRAINT` + `ADD CONSTRAINT`는 ACCESS EXCLUSIVE 락**
- 위치: `V042__cafe24_private_app_pending_install.sql` L~20-25
- 상세: PostgreSQL에서 CHECK constraint 변경은 `ALTER TABLE`이 ACCESS EXCLUSIVE 락을 획득한다. 운영 환경에서 `integration` 테이블이 활발히 사용 중이라면 마이그레이션 실행 중 읽기/쓰기가 블록된다.
- 제안: `NOT VALID` + 별도 `VALIDATE CONSTRAINT`로 락 점유 시간을 최소화하거나, 배포 점검 시간대에 실행. ADD COLUMN(`install_token`)의 경우 PostgreSQL 11+에서 nullable 컬럼 추가는 즉시 처리되어 문제없다.

---

**[INFO] `install_token` 컬럼에 인덱스 없음**
- 위치: `V042__cafe24_private_app_pending_install.sql`
- 상세: `install_token`으로 조회가 추가될 경우(위 WARNING 반영 시) 인덱스가 없어 전체 테이블 스캔이 발생한다.
- 제안: `CREATE INDEX idx_integration_install_token ON integration (install_token) WHERE install_token IS NOT NULL;` 추가.

---

**[INFO] `getMany()` 결과에 LIMIT 없음**
- 위치: `integration-oauth.service.ts` — `handleInstall()` L~655
- 상세: pending 통합이 이론상 무제한으로 증가할 수 있는 구조에서 쿼리에 상한이 없다. 현재는 트래픽 규모상 문제없을 수 있으나, 방어적 `.take(100)` 추가를 권장한다.

---

### 요약

성능 관점의 핵심 문제는 `handleInstall`에 집중된다. 이 메서드는 시스템 전체 `pending_install` 통합을 메모리로 끌어올려 인메모리 필터링을 하는데, 이때 `verifyHmac`가 변하지 않는 rawQuery를 후보마다 반복 파싱하는 이중 낭비가 발생한다. 이미 마이그레이션에 추가한 `install_token` 컬럼이 App URL 전달 → 단일 행 인덱스 조회 패턴을 지원하도록 설계된 것으로 보이나, 실제 `handleInstall`에서 활용되지 않아 설계 의도가 절반만 구현된 상태다. 나머지 파일들(프론트엔드, 엔티티 타입, 문서)은 성능 관점에서 무결하다.

### 위험도

**HIGH** — 서비스가 성장해 `pending_install` 통합이 쌓이면 `handleInstall` 호출 시 지연이 선형 증가한다. 현재 규모에서는 잠재적 문제이나, `install_token` 미활용 + 무제한 스캔의 조합은 조기에 수정할 것을 권장한다.