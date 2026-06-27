# 신규 식별자 충돌 검토 결과

검토 대상: `spec/5-system/` (diff-base: origin/main, 변경 파일: `2-api-convention.md`, `7-llm-client.md`)

---

## 발견사항

### [INFO] `PROVIDER_PROBE_THROTTLE` 행이 공유 출처 `SENSITIVE_ACTION_THROTTLE` 를 누락

- **target 신규 식별자**: `SENSITIVE_ACTION_THROTTLE` (`spec/5-system/2-api-convention.md` 신규 행, `codebase/backend/src/common/constants/throttle.ts` 신규 파일)
- **기존 사용처**: `spec/5-system/2-api-convention.md` 기존 행 — "3 핸들러 공통 컨트롤러 상수 `PROVIDER_PROBE_THROTTLE`". `spec/5-system/7-llm-client.md` (신규 추가 단락 포함) — "공통 컨트롤러 상수 `PROVIDER_PROBE_THROTTLE`"
- **상세**: 실제 구현(`llm-model-config.controller.ts`)에서 `PROVIDER_PROBE_THROTTLE = SENSITIVE_ACTION_THROTTLE`(alias) 로 재정의되었다. 그러나 api-convention 의 provider probe 행과 `7-llm-client.md` 신규 단락 모두 여전히 `PROVIDER_PROBE_THROTTLE` 만 언급하고 `SENSITIVE_ACTION_THROTTLE` 를 언급하지 않는다. 초대 행은 "공통 tier 상수 `SENSITIVE_ACTION_THROTTLE`(별칭 `INVITATION_THROTTLE`)" 로 표기해 공유 출처를 명시하지만, 초대 행과 probe 행 사이에 표기 일관성이 없다. 식별자 충돌은 아니며 의미 혼선도 없으나 단일 출처(`SENSITIVE_ACTION_THROTTLE`)를 spec 에서 절반만 드러낸다.
- **제안**: `spec/5-system/2-api-convention.md` provider probe 행을 "공통 tier 상수 `SENSITIVE_ACTION_THROTTLE`(별칭 `PROVIDER_PROBE_THROTTLE`)" 형식으로 통일. `spec/5-system/7-llm-client.md` 신규 단락도 동일 형식 적용.

---

### [INFO] `1-auth.md`·`data-flow/12-workspace.md` 가 `INVITATION_THROTTLE` 를 독립 상수로 표기

- **target 신규 식별자**: `SENSITIVE_ACTION_THROTTLE` (공유 tier 상수)
- **기존 사용처**: `spec/5-system/1-auth.md` §1.5.1 — "분당 10건 (`INVITATION_THROTTLE`, `workspaces.controller.ts` — invite·resend 엔드포인트 공통)". `spec/data-flow/12-workspace.md` — "분당 10건(`workspaces.controller.ts` `INVITATION_THROTTLE`)"
- **상세**: 두 파일은 이번 diff 에 포함되지 않아 갱신되지 않았다. 실제 코드에서 `INVITATION_THROTTLE` 는 이제 `SENSITIVE_ACTION_THROTTLE` 의 controller-local alias 이므로, "독립 상수" 라는 뉘앙스는 엄밀히 부정확해진다. 다만 `workspaces.controller.ts` 에 `const INVITATION_THROTTLE = SENSITIVE_ACTION_THROTTLE` 로 alias 가 여전히 존재하고 수치(10 req/min)도 동일하므로 사실 오류는 아니다. 진짜 충돌은 없다.
- **제안**: `1-auth.md` §1.5.1 과 `data-flow/12-workspace.md` 표기를 "분당 10건 (`SENSITIVE_ACTION_THROTTLE` — `INVITATION_THROTTLE` alias, `workspaces.controller.ts`)" 으로 align. 단, 수치·동작이 동일하므로 즉각 수정이 필수는 아니다.

---

## 확인 완료 항목 (충돌 없음)

| 신규 식별자 | 위치 | 판정 |
|---|---|---|
| `SENSITIVE_ACTION_THROTTLE` | `codebase/backend/src/common/constants/throttle.ts` (신규) | 기존 어느 spec·코드에도 사용된 바 없음 — 충돌 없음 |
| `MAX_MODEL_LIST_SIZE` | `codebase/backend/src/modules/llm/list-models-cap.ts` (신규) | 기존 미사용 — 충돌 없음 |
| `capModelList` | 동일 파일 | 기존 미사용 — 충돌 없음 |
| `list-models-cap.ts` 파일 경로 | `src/modules/llm/` | 기존 파일 없음, 명명 컨벤션 부합 — 충돌 없음 |
| `throttle.ts` 파일 경로 | `src/common/constants/` (신규) | `presentation.ts` 와 동일 디렉터리, 기존 충돌 없음 |
| API endpoints (초대 throttle 행) | `POST /api/workspaces/:id/invitations`, `.../resend` | 이미 다른 spec 에 정의된 endpoint 를 rate-limit 표에 추가한 것뿐 — 새 endpoint 정의 아님, 중복 정의 없음 |

---

## 요약

이번 변경(`spec/5-system/2-api-convention.md` 초대 throttle 행 추가, `spec/5-system/7-llm-client.md` `list-models-cap.ts`/`MAX_MODEL_LIST_SIZE` 문서화)이 도입하는 신규 식별자는 기존 spec·코드 어디에서도 다른 의미로 사용된 사례가 없다. `SENSITIVE_ACTION_THROTTLE` 는 완전히 새로운 이름이고, `INVITATION_THROTTLE`·`PROVIDER_PROBE_THROTTLE` 는 의미가 변하지 않은 채 alias 로 계속 존재한다. 발견된 두 항목은 모두 "probe 행과 초대 행 간 표기 비대칭", "구버전 auth/data-flow spec 미동기화" 수준의 INFO 이며, 사용자·시스템 혼선을 유발하는 실제 충돌은 없다.

## 위험도

LOW
