# Cross-Spec 일관성 검토 결과

검토 대상: `03-maintainability M-2: frontend API_BASE_URL 분산 정의 통합 + 3001 to 3011 fallback 정정 (lib/api/constants.ts 단일화, behavior-preserving)`
검토 모드: --impl-done
diff-base: origin/main

---

## 발견사항

### [INFO] spec 이 port 를 명시하지 않아 3011 fallback 이 spec-silent 상태 — 단, 환경 파일 참조로 간접 확인 가능

- target 위치: `codebase/frontend/src/lib/api/constants.ts:18` (`LOCAL_API_FALLBACK = "http://localhost:3011/api"`)
- 충돌 대상: `spec/0-overview.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/6-websocket-protocol.md`
- 상세: spec 문서들은 API base URL 을 `{base_url}` 추상 placeholder 로 기술하며 포트 번호를 직접 규정하지 않는다. 실제 포트 3011 의 canonical SoT 는 `codebase/backend/.env.example:APP_PORT=3011` 과 `codebase/frontend/.env.example:NEXT_PUBLIC_API_URL="http://localhost:3011/api"` 이며, `constants.ts` 의 주석도 이를 명시한다. 계획 문서 `plan/in-progress/refactor/03-maintainability.md M-2` 가 "spec 은 포트 미규정이 적절" 이라고 명시했으므로 spec 갱신은 불요하다. 모순 없음.
- 제안: 현 상태 유지. spec 의 `{base_url}` 추상 표기가 의도된 패턴이다.

---

### [INFO] `auth-providers.ts` 의 `cache: "no-store"` — spec 이 `revalidate: 300` 을 언급하지만 이 변경의 책임 밖

- target 위치: `codebase/frontend/src/lib/api/auth-providers.ts:26` (변경 후에도 `cache: "no-store"` 유지)
- 충돌 대상: `/Volumes/project/private/clemvion/spec/2-navigation/10-auth-flow.md:334` ("Next.js Server Component `fetch` 의 `revalidate: 300` 와 정합")
- 상세: `spec/2-navigation/10-auth-flow.md §5` 는 `GET /api/auth/oauth/providers` 응답의 서버 캐시 정책을 `Cache-Control: private, max-age=300` + 클라이언트 `revalidate: 300` 으로 명시한다. 그러나 `origin/main` 의 `auth-providers.ts` 는 이미 `cache: "no-store"` 를 사용하며 이는 M-2 이전부터 존재하던 코드다. M-2 diff 는 이 부분을 변경하지 않는다 — 단지 inline `API_BASE_URL` 상수를 `getServerApiBaseUrl()` 임포트로 대체할 뿐이다. 즉 이 불일치는 M-2 가 도입한 것이 아니라 기존 drift 이며 M-2 의 책임 밖이다.
- 제안: M-2 범위 외. 별도 spec-sync 태스크에서 `spec/2-navigation/10-auth-flow.md §5` 의 `revalidate: 300` 표기를 코드 현실(`no-store`, 컨테이너 read-only filesystem EROFS 회피 이유 있음)로 정정하거나 코드를 spec 에 맞게 복원하도록 추적 필요.

---

## 충돌 없음 확인 항목

아래 관점별로 M-2 변경 내용을 검토한 결과 실질 충돌은 없다:

1. **데이터 모델 충돌**: M-2 는 URL 상수 중앙화이며 데이터 모델(`spec/1-data-model.md`) 의 어떤 엔티티·필드도 수정하지 않는다.

2. **API 계약 충돌**: M-2 는 endpoint · HTTP method · request/response shape 을 변경하지 않는다. `API_BASE_URL` 값은 env 설정 시 `process.env.NEXT_PUBLIC_API_URL` 로 결정되어 기존과 동일하다. env 미설정 시 3001→3011 정정은 spec(`spec/5-system/2-api-convention.md`)의 API 계약과 무관한 로컬 fallback 수정이다.

3. **요구사항 ID 충돌**: M-2 는 신규 요구사항 ID 를 부여하지 않는다.

4. **상태 전이 충돌**: 상태 머신 변경 없음.

5. **권한·RBAC 모델 충돌**: 인증/인가 로직 변경 없음.

6. **계층 책임 충돌**: `lib/api/constants.ts` 는 `lib/api/` 내부의 신규 단일 정의처로, spec 이 별도 책임 경계를 명시하지 않는 레이어다. `spec/5-system/4-execution-engine.md` 의 `code:` frontmatter 에 `codebase/frontend/src/lib/websocket/ws-client.ts` 가 등재되어 있지만, M-2 는 `WS_BASE_URL` export 를 추가해 `ws-client.ts` 가 이를 import 하도록 변경할 뿐이며 WebSocket 프로토콜·재연결 거동은 그대로다. `spec/5-system/6-websocket-protocol.md` 이 명시하는 `reconnection: true` · transport `['websocket', 'polling']` 등 거동 계약은 미변경이다.

---

## 요약

M-2 변경(frontend `API_BASE_URL` 분산 정의 → `lib/api/constants.ts` 단일화 + 3001→3011 fallback 정정)은 spec 의 어떤 API 계약·데이터 모델·상태 전이·RBAC 규칙과도 충돌하지 않는다. spec 은 포트 번호를 직접 규정하지 않으므로 3011 fallback 통일도 spec-silent 영역의 구현 정합성 수정에 해당한다. 유일하게 기록할 사항은 `spec/2-navigation/10-auth-flow.md §5` 의 `revalidate: 300` 표기가 기존 코드의 `cache: "no-store"` 와 이미 불일치 상태였으나 이는 M-2 이전 drift 이며 본 변경의 책임 밖이다.

---

## 위험도

LOW
