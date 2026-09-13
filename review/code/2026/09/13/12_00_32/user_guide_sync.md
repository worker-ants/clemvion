# User Guide Sync Review

## 컨텍스트

`.claude/config/doc-sync-matrix.json` (rows[]) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을
SSOT 로 적재했다. 이번 diff 는 `plan/in-progress/guide-error-code-truth.md` 가 기술하는 배치 —
유저 가이드가 이름 붙인 에러 코드 5종(지어낸 것 1·은퇴한 것 2·로드맵 전용 2)의 진위를 맞추고,
그 klass 를 build-time 가드(`guide-error-code-existence.test.ts` / `guide-error-code-scan.ts`)로
고정하는 작업이다. 이 changeset 자체가 이미 **5라운드**의 `/ai-review` + `--impl-done` 을 거쳤고
(`review/code/2026/09/13/{10_12_19,10_40_34,11_07_36,11_33_23}`,
`review/consistency/2026/09/13/{01_15_40,10_12_54,10_41_13,11_08_03,11_33_51}`), 직전 라운드가
잡은 CRITICAL(`MAKESHOP_UNRESOLVED_PATH_PARAM` 오귀속)을 이번 커밋(`42680d5f9`)이 해소했다.

## 매트릭스 trigger 매칭

| Trigger (id) | 매칭 파일 | 판정 |
|---|---|---|
| `backend-api-change` (semantic, `**/*.controller.ts` / `dto/**`) | `integration-response.dto.ts`(`code` 추가·`latencyMs`/`meta` 제거) · `model-config-response.dto.ts`(`latencyMs` 제거) · `llm.service.ts`(`error`→`message`) | 충족 — swagger JSDoc 동반(`code` 필드에 `/** 실패 분류 코드... */`), user-guide 페이지(`models{,.en}.mdx`)가 같은 커밋 체인 안에서 실제 응답 shape 로 갱신됨 |
| `run-debug-flow-change` | `05-run-and-debug/{error-handling,run-results}{,.en}.mdx` | 충족 — 대상 문서 자체가 이 배치의 목적물. ko/en 4파일 전부 mirrored |
| `userguide-gui-flow-section` (`06-integrations-and-config/**.mdx`) | `models{,.en}.mdx` | 충족 — `<ImplAnchor kind="api-endpoint" file=... symbol="testConnection">` 신규 추가, `file`/`symbol` 실재 확인(`llm-model-config.controller.ts` 의 `testConnection`) |
| `integration-provider-change` (semantic) | `02-nodes/integrations{,.en}.mdx` (MakeShop 절) | 충족 — `MAKESHOP_API_ERROR` → `MAKESHOP_404` + 실재 코드 계열 설명, ko/en 동시 |
| `new-node` / `node-schema-change` | 매칭 없음 | N/A — `codebase/backend/src/nodes/**` 신규 파일·필드 변경 없음 (DTO 변경은 있으나 노드 스키마 아님) |
| `new-ui-string` (TSX 신규 한국어 리터럴) | 매칭 없음 | N/A — `model-config-manager.tsx` 프로덕션 코드 자체는 diff에 없음(테스트만 추가), 기존 `t("models.connectionFailed", …)` 키 재사용 |
| `new-userguide-section-dir` | 매칭 없음 | N/A |
| `new-warning-code` / `new-error-code` | 매칭 없음 | N/A — `error-codes.ts` 변경 없음. 이 배치는 신규 코드 발행이 아니라 **가이드가 적은 기존 코드명의 진위 검증** |
| `auth-session-flow-change`, `expression-language-change` | 매칭 없음 | N/A |

## 상세 점검 — 잠재 누락 후보

**i18n dict / backend-labels.ts**: 이 changeset 은 `dict/{ko,en}/*.ts` · `backend-labels.ts` 를
전혀 건드리지 않는다. 매칭 대상(DTO 필드 rename, MDX 표 정정)이 모두 MDX 프로즈 레벨이라
dict 경유 문자열이 아니므로 정합하다. 새 warning/error code 발행도 없어 `WARNING_KO`/`ERROR_KO`
갱신 의무도 발생하지 않는다.

**ko/en MDX parity**: `integrations`, `error-handling`, `run-results`, `models` 4쌍 전부 ko/en
동시 갱신 확인(각 파일 diff 대조 — 문장 번역만 다르고 구조·코드 목록 동일). 누락 없음.

**PROJECT.md 가드 카탈로그**: 신규 가드 2건(`guide-error-code-existence.test.ts`,
`guide-sanitized-message-parity.test.ts`)이 §자동 가드 목록에 **같은 커밋 체인 안에서** 등재됨
(라운드 4 ai-review W#3 처분). 매트릭스 참조 무결성 유지.

**Cafe24 twin 케이스 확인** — `cafe24.handler.ts:453` 의 `CAFE24_UNRESOLVED_PATH_PARAM` 이
MakeShop 자매(`makeshop.handler.ts:436`)와 동형(일반 `Error` throw → `INTEGRATION_CALL_FAILED`
fallback)임을 직접 grep 으로 재확인했다. 다만 `cafe24{,.en}.mdx` 는 이 토큰을 **전혀 인용하지
않는다**(`content/docs/` 전수 grep 0건, 직접 재확인) — 즉 오늘 시점 가이드에 거짓 서술이
없으므로 CRITICAL/WARNING 대상은 아니다. 이미
`plan/in-progress/spec-draft-nullable-notation-followups.md:3346-3350` 에 후속 항목으로
정확히 등재돼 있음을 확인했다(handler 를 고칠 때 함께 본다는 처분). 신규 발견 아님 —
기존 트래킹이 정확함을 검증한 것으로 기록.

**`spec/conventions/user-guide-evidence.md §2.1` 관계표 미갱신**: 신규 가드 2건이 아직 그
관계표에 등재되지 않았으나, `spec/**` 는 developer 쓰기 권한 밖이라 planner 위임이 정상 경로다
(plan §D 에 "developer 소유 문서(PROJECT.md)에는 등재, spec 관계표는 planner 소관 → 등재"로
명시). 프로세스 위반 아님 — 매트릭스가 요구하는 "동일 PR/turn 동시 갱신" 규칙의 예외(spec 쓰기
권한 분리)에 해당.

## 발견사항

없음 — 매칭된 trigger 전부 동일 changeset(커밋 체인) 안에서 동반 갱신이 확인됨. 잠재 그레이존
후보(Cafe24 twin 케이스)는 실측 결과 오늘 시점 위반이 아니며 이미 정확히 트래킹되어 있다.

## 요약

매트릭스 20개 trigger 행 중 4개(backend-api-change · run-debug-flow-change ·
userguide-gui-flow-section · integration-provider-change)가 이 changeset 에 매칭됐고, 넷 다
동일 커밋 체인 안에서 swagger JSDoc·user-guide MDX(ko/en)·`<ImplAnchor>`·가드 카탈로그 등재가
완료됨을 확인했다. i18n dict/backend-labels 경유 trigger 는 매칭 없음(N/A). 잠재 누락 후보로
직접 조사한 Cafe24 twin 케이스는 실측 결과 현재 가이드에 거짓 서술이 없고 후속 plan 에 정확히
등재돼 있어 결함이 아니다. 누락 0건.

## 위험도

NONE
