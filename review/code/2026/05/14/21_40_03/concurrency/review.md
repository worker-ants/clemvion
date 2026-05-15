### 발견사항

- **[CRITICAL]** `expirePendingInstalls`의 read-modify-write 비원자성
  - 위치: `integration-expiry-scanner.service.ts` — `expirePendingInstalls` 메서드
  - 상세: `find` → in-memory 상태 변이 → `save`의 세 단계 사이에 Cafe24 콜백이 성공하면 해당 row의 `status`가 `connected`로 변경된 뒤 스캐너의 `save`가 이를 다시 `expired`로 덮어씁니다. 스캐너는 일 1회이므로 창이 좁지만, `handleInstall` → `handleCallback` 완료까지 수십 초 걸릴 수 있어 현실적 위험입니다.
  - 제안: 개별 row를 읽어 메모리에서 수정하는 대신 단일 UPDATE 쿼리로 원자적 전이를 수행하세요.
    ```typescript
    await this.integrationRepository
      .createQueryBuilder()
      .update(Integration)
      .set({ status: 'expired', statusReason: 'install_timeout', installToken: null })
      .where('status = :s', { s: 'pending_install' })
      .andWhere('createdAt < :cutoff', { cutoff })
      .execute();
    ```
    이렇게 하면 DB가 조건 검사와 쓰기를 원자 단위로 처리하여 concurrent callback과의 경쟁이 없어집니다.

---

- **[WARNING]** `beginCafe24Private` 중복 방지의 TOCTOU 경쟁 조건
  - 위치: `integration-oauth.service.ts` — 변경 3 중복 방지 로직
  - 상세: `find`로 기존 row를 확인한 뒤 조건 분기(`existingPending ? reuse : create`)까지 임계 구간이 존재합니다. 동일한 `mall_id`로 두 요청이 동시에 도착하면 둘 다 `existingPending === undefined`를 보고 각자 새 row를 생성할 수 있습니다. V043의 partial UNIQUE index는 `install_token`(충돌 불가능한 256-bit random)에 걸려 있어 이 경쟁을 차단하지 못합니다. plan 문서도 이를 인지("TOCTOU race 방어: advisory lock... 구현 시점 결정")하고 있지만 현재 코드에 보호 장치가 없습니다.
  - 제안: `pg_advisory_xact_lock(hashtext(workspaceId || mall_id))`를 트랜잭션 내에서 획득하거나, `mall_id`를 평문 컬럼으로 분리 후 `(workspaceId, serviceType, mall_id, app_type) WHERE status = 'pending_install'`에 partial UNIQUE index를 추가하세요.

---

- **[WARNING]** 팝업 closed 감지의 stale closure 및 cleanup 누락
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` — `oauthWaiting` effect 내 `setInterval`/`setTimeout` 중첩
  - 상세: `setInterval` 콜백 내에서 `setTimeout(() => { if (!oauthWaiting) return; ... }, 1500)`이 실행됩니다. 이 `setTimeout` 콜백은 1500ms 후에 실행되는데, 그 시점에 읽히는 `oauthWaiting`은 closure에 캡처된 낡은 값입니다. `oauthWaiting`이 이미 `false`가 된 뒤에도 `true`로 읽혀 에러 처리가 중복 실행될 수 있습니다. 또한, `setInterval`이 해제된 뒤 이미 예약된 `setTimeout`은 cleanup에서 취소되지 않아 컴포넌트 언마운트 후에도 `setOauthWaiting`, `toast.error` 등이 호출됩니다.
  - 제안: `setTimeout`의 반환 id를 저장해 effect cleanup에서 함께 `clearTimeout`하고, 상태 최신값이 필요한 경우 `useRef`로 동기화하거나 `setOauthWaiting(prev => { if (!prev) return false; ... })` 함수형 업데이터를 사용하세요.

---

- **[INFO]** `process()` 내 세 패스의 순차 실행
  - 위치: `integration-expiry-scanner.service.ts` — `process` 메서드
  - 상세: `run`, `expirePendingInstalls`, `pruneUsageLogs`는 각각 독립적이며 `.catch()`로 오류가 격리됩니다. 주석도 독립 실행을 명시하지만 세 `await`는 순차 실행됩니다. 성능 손실 자체는 작지만, 병렬화 가능한 구조입니다. 다만 `run()`과 `expirePendingInstalls()` 모두 `integration` 테이블을 업데이트하므로 병렬 실행 시 동일 `pending_install` row에 대한 동시 쓰기가 이론적으로 가능합니다(현실적 교집합은 희박). 순차 실행이 오히려 이를 피하는 보수적 선택입니다.
  - 제안: 현 상태 유지가 적절합니다. 만약 병렬화할 경우 위 CRITICAL 항목의 원자적 UPDATE가 선행되어야 안전합니다.

---

### 요약

변경 코드의 핵심 동시성 위험은 두 곳입니다. 첫째, `expirePendingInstalls`의 find-then-save 패턴은 OAuth 콜백과 경쟁할 때 `connected` 상태를 `expired`로 덮어쓸 수 있으며, 이는 원자적 UPDATE 쿼리로 해소해야 합니다. 둘째, `beginCafe24Private`의 중복 방지 로직은 TOCTOU 창이 존재해 동시 요청 시 중복 `pending_install` row가 생성될 수 있고, plan이 인지한 advisory lock 또는 DB 레벨 UNIQUE 제약이 아직 미구현 상태입니다. 프론트엔드의 stale closure는 UX 버그 수준이며, 나머지는 안전하게 설계되어 있습니다.

### 위험도
**MEDIUM** (CRITICAL 항목이 daily 스캐너 타이밍 때문에 발생 빈도는 낮으나, 발생 시 `connected` → `expired` 강제 전이라는 데이터 정합성 손상이 발생함)