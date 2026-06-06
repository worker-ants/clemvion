# Security Review

## 발견사항

### **[WARNING]** interaction token fallback secret 체인이 공개 spec 문서에 리터럴로 노출
- 위치: `spec/5-system/14-external-interaction-api.md` §8.3 (변경된 섹션, L1907)
- 상세: 신규 spec 텍스트가 `iext_*` 토큰 서명 secret 결정 순서를 `INTERACTION_JWT_SECRET` → `configService jwt.secret` → `JWT_SECRET` → fallback `'interaction-fallback'` 순으로 명시한다. 마지막 fallback 리터럴 `'interaction-fallback'`이 공개 저장소에 체크인된 spec 문서에 노출되어 있어, 환경변수 미설정 상태의 운영 서버에서 이 예측 가능한 값으로 interaction 토큰이 서명될 수 있다.
- 제안: (1) `main.ts` 또는 ConfigService 초기화 시 `INTERACTION_JWT_SECRET`(또는 `JWT_SECRET`) 미설정이면 `NODE_ENV=production` 에서 fail-closed throw 하는 가드가 이미 구현되어 있는지 확인한다. `LLM_STUB_MODE`에 동일한 production 차단 로직이 있으므로 동일 패턴 적용을 권장한다. (2) spec 문서에서 fallback 리터럴 값 자체를 명시하지 않고 "코드 상세는 interaction-token.service.ts 참조"로 대체할 것.

### **[WARNING]** e2e docker-compose 의 ENCRYPTION_KEY 가 엔트로피 극히 낮은 순차 패턴
- 위치: `docker-compose.e2e.yml` L886, L1038
- 상세: `ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef` 는 순차 hex 패턴으로 AES-256 키로서 엔트로피가 사실상 없다. 이번 변경에서 32-char(16B) 에서 64-hex(32B)로 길이는 교정했으나 값 패턴은 동일하다. e2e DB가 ephemeral이고 "운영 절대 사용 금지" 주석이 있어 실질 위험은 낮지만, CI 스냅샷 보존·이미지 레이어 캐시 공유 등 의도치 않은 환경에서 이 키로 암호화된 데이터가 남을 수 있다.
- 제안: CI 시크릿 인젝션(`${{ secrets.E2E_ENCRYPTION_KEY }}`) 또는 셸 표현식으로 랜덤 64-hex 생성(`$(openssl rand -hex 32)`)을 사용하여 예측 불가한 값으로 교체할 것. 최소한 패턴을 정적 랜덤 값(`a3f7...`)으로 변경하는 것을 권장한다.

### **[INFO]** e2e 테스트 소스 내 JWT_SECRET 하드코딩 fallback
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` L495-497
- 상세: `const JWT_SECRET = process.env.JWT_SECRET ?? 'clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7'` 가 소스에 직접 포함되어 있다. 이 값으로 `mintInteractionToken`이 `iext_*` JWT를 서명한다. 코드 주석에 "테스트 전용 시크릿, repo 에 공개됨"이 명시되어 있고 환경변수 우선 구조도 올바르다. e2e Docker 네트워크가 격리되어 있으므로 실질 위험은 낮다.
- 제안: CI 파이프라인에서 `JWT_SECRET` 환경변수가 항상 주입되는지 확인한다. `beforeAll`에서 환경변수 미설정 시 `skip` 또는 명시적 에러로 차단하면 fallback 경로 의존을 제거할 수 있다.

### **[INFO]** mintInteractionToken이 production 서비스와 동형 JWT payload를 직접 생성
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` L521-529
- 상세: 테스트 코드가 `sign({ sub: executionId, aud: 'interaction', jti: randomUUID() }, JWT_SECRET, { algorithm: 'HS256', expiresIn: 3600 })` 로 운영 코드의 `InteractionTokenService.issuePerExecution`과 동일한 payload 구조의 JWT를 직접 mint한다. e2e 테스트 목적상 불가피한 화이트박스 패턴이나, 이 함수가 운영 코드와 함께 번들될 경우 위험하다.
- 제안: 해당 함수가 test 디렉토리에만 존재하고 production 빌드에서 tree-shaking/exclude되는 구조인지 확인한다(현재 `test/` 디렉토리 분리로 충분). 이번 변경은 기존 패턴 유지이므로 신규 위험 없음.

### **[INFO]** DB 직접 쿼리에 parameterized query 일관 적용 확인
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` 전체
- 상세: 변경된 코드 및 기존 코드의 모든 `db.query()` 호출이 PostgreSQL parameterized query(`$1`, `$2`, ...) 패턴을 올바르게 사용한다. 이번 변경에서 제거된 INSERT 쿼리도 동일 패턴을 사용했었다. SQL 인젝션 위험 없음.

### **[INFO]** spec 문서 §10.1의 in-process trusted caller 범위 명확화
- 위치: `spec/5-system/14-external-interaction-api.md` §3.3.1 (기존 spec, 이번 diff 외 영역)
- 상세: `scope: 'in_process_trusted'` 컨텍스트 오염 방지 가드(HTTP guard 에서 scope set 금지 invariant)가 spec에 상세히 문서화되어 있다. 이번 변경은 이 섹션을 수정하지 않으나, §8.3 변경으로 토큰 family 명확화가 이루어져 해당 가드의 의미가 더 명확해졌다. 보안 관점 양호.

---

## 요약

이번 변경은 e2e 테스트 인프라(ENCRYPTION_KEY 64-hex 교정, llm-config 생성을 DB 직접 insert 우회에서 정식 API 호출로 교체)와 spec 문서 갱신(EIA §8.3 토큰 family 구분 명확화, LLM_STUB_MODE 섹션 추가)이 주 내용이다. 프로덕션 코드 변경이 없고 모든 변경이 테스트 파일·e2e 설정·spec 문서에 국한된다. 주된 보안 우려는 두 가지다: (1) spec §8.3에 interaction token fallback 리터럴 `'interaction-fallback'`이 공개 문서에 노출된 점 — 프로덕션 fail-closed 가드 구현 여부 확인이 필요하다. (2) docker-compose e2e의 ENCRYPTION_KEY가 엔트로피 없는 순차 패턴이며, 길이 교정(`32char→64hex`)은 이루어졌으나 값 자체를 랜덤화하는 것이 보안 위생 관점에서 권장된다. 두 항목 모두 e2e 격리 환경에 국한되어 즉각적 운영 위험은 없으나 개선이 권장된다.

---

## 위험도

LOW
