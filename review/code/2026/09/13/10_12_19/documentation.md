# 문서화(Documentation) 코드 리뷰

## 검토 범위와 방법

프롬프트 번들의 28개 파일 중 절단된(⚠️ 표시) 전체 컨텍스트는 `Read`로 원본을 직접 열어 대조했다.
`CHANGELOG.md`, `spec/5-system/7-llm-client.md §6·§8.3`, `spec/5-system/3-error-handling.md §1.4`,
`spec/conventions/user-guide-evidence.md`, `codebase/frontend/src/lib/docs/__tests__/impl-anchor-parse.ts`
를 직접 열어 새 문서·주석의 인용이 실측과 맞는지 확인했다. 신규 가드 두 개
(`guide-error-code-existence.test.ts` 13건, `impl-anchor-existence.test.ts` 243건)를 `vitest run`
으로 실행해 통과를 확인했다. **저장소 파일은 전혀 뮤테이션하지 않았다** — 종료 시
`git status --short` 로 확인, 이 리뷰 세션 자신의 산출물 디렉터리 3개(`review/code/.../10_11_53`,
`review/code/.../10_12_19`, `review/consistency/.../10_12_54`)만 untracked 로 남아 있다.

## 발견사항

- **[INFO]** 이번 배치가 고친 결함의 spec 층 근본 원인(§8.3 이 `testConnection` 실패 shape 를
  문서화하지 않음)이 아직 spec 에 반영되지 않았다 — 단, 정당하게 유예됐다
  - 위치: `spec/5-system/7-llm-client.md §8.3`("LlmService.testConnection — kind별 probe 전략" 표,
    `chat`→`{ success: true }`, `embedding`→`{ success: true, dimension? }` 만 있고 실패 행 없음).
    직접 `Read` 로 확인 — grep 0건.
  - 상세: `plan/in-progress/guide-error-code-truth.md` §A 가 실측한 3층 불일치(`error`/`message`)의
    근본 원인이 "형제 엔드포인트(`2-navigation/4-integration.md §9.1`)는 실패 shape 문서화가 있는데
    이쪽엔 앵커가 없어 가이드가 지어냈다"는 것인데, 이 코드 수정 이후에도 그 앵커 부재는 그대로다.
    `llm.service.ts` 는 `7-llm-client.md` 의 spec-linked 대상이라 `--impl-done` 게이트가 이 gap 을
    다시 지적할 수 있다는 것을 `plan_coherence.md`/`naming_collision.md` 양쪽이 이미 짚어 두었다.
  - 처분 확인: developer 는 `spec/` 쓰기 권한이 없어(CLAUDE.md) 이를 코드로 직접 고치지 않고
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 앞 항목으로 정확히
    등재했다("`testConnection` 실패 응답 shape 이 어느 spec 표에도 없다" — 5개 checker 전원 지적
    인용, `sanitize-error.util.ts` 를 SoT 로 명시). **이 처리 자체는 규약을 정확히 따른 것**이라
    CRITICAL/WARNING 아님 — 다만 `--impl-done` 라운드에서 이 gap 이 재부상할 가능성이 높다는
    사실을 다음 검토자가 알고 있도록 INFO 로 남긴다.
  - 제안: 없음(이미 planner 트래커에 등재·추적 중). `--impl-done` 실행 시 이 항목이 재-flag 되면
    오탐이 아니라 이미 알려진 잔여 gap 이다.

- **[INFO]** 같은 사유로 `spec/5-system/3-error-handling.md §1` 카탈로그의 Cafe24/Makeshop/OAuth/
  LLM 도메인 코드 누락(§C 결함 `MAKESHOP_API_ERROR` 지어냄의 구조적 원인)과
  `spec/conventions/user-guide-evidence.md §2.1` 관계표에 신규 가드 미등재도 같은 방식으로 확인·유예됐다
  - 위치: `spec/5-system/3-error-handling.md §1.4`, `spec/conventions/user-guide-evidence.md §2.1`
  - 상세: 둘 다 `--impl-prep` 5개 checker(`review/consistency/2026/09/13/01_15_40`)가 WARNING 으로
    짚었고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 developer 가 3건 모두를
    planner 앞 항목으로 정확히 옮겨 적었음을 diff 로 확인했다(파일 20). `guide-error-code-existence`
    가드 자체는 이미 `spec/conventions/user-guide-evidence.md` 의 가드 가족 위치
    (`codebase/frontend/src/lib/docs/__tests__/`)에 올바르게 배치돼 있고 자매 `impl-anchor-existence`
    와의 관계(같은 방향·다른 표면)도 코드 주석·plan §D 양쪽에 명시돼 있다 — 남은 것은 spec 문서의
    "관계표 행 추가"뿐이다.
  - 제안: 없음(추적 중). 코드 리뷰 관점에서는 처리 절차가 정확했다는 확인 차원의 기록.

- **[INFO]** 상위 트래커의 반증된 처분 문장이 취소선+정정으로 올바르게 갱신됐다 (확인, 문제 없음)
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` L3162-3163 부근
  - 상세: `--impl-prep` plan_coherence checker 가 "`LLM_CONNECTION_ERROR` 를 적으라"는 기존 처분
    제안이 이번 실측(이 엔드포인트는 어떤 `LLM_*` 코드도 내지 않는다)으로 반증됐는데 체크리스트가
    이를 명시하지 않는다고 WARNING 을 냈다. diff 를 보면 developer 가 그 문장을 삭제하지 않고
    `~~취소선~~` 으로 남긴 뒤 "위 취소선: 그 처분이 내 실측에 반증됐다" 정정 문단을 추가했다 —
    이 저장소가 반복 지적해 온 "체크박스만 바뀌고 근거 문장이 낡은 채 남는" 패턴을 이번엔 피했다.
    긍정적 확인이며 별도 조치 불요.

- **[INFO]** MDX 가이드 문서 국제화 쌍(ko/en) 갱신 일관성 및 잔존 참조 재검 — 문제 없음
  - `integrations.mdx`/`.en.mdx`, `error-handling.mdx`/`.en.mdx`, `run-results.mdx`/`.en.mdx`,
    `models.mdx`/`.en.mdx` 네 쌍 모두 ko/en 이 함께 갱신됐다. `grep -rn` 으로
    `codebase/frontend/src/content/docs/` 전체를 재검사해 `NODE_EXECUTION_FAILED`·`INTEGRATION_ERROR`·
    `MAKESHOP_API_ERROR`·`LLM_AUTH_ERROR`·`LLM_MODEL_NOT_FOUND` 잔존 참조가 0건임을 확인했다.
  - `models{,.en}.mdx` 의 신규 `<ImplAnchor kind="api-endpoint" file="…llm-model-config.controller.ts"
    symbol="testConnection" .../>` 는 `impl-anchor-parse.ts` 의 `VALID_KINDS`(`api-endpoint` 포함)와
    일치하고, `symbol="testConnection"` 은 실제로 그 컨트롤러에 존재함을 `grep` 으로 확인했다.
    `impl-anchor-existence.test.ts` 243건 전부 통과(`vitest run` 재실행 확인) — 이 신규 앵커가
    기존 가드를 깨지 않는다.
  - 프런트엔드 `model-config-manager.tsx:83` 가 `result.message ?? ""` 를 읽고 있다는 CHANGELOG/plan
    의 서술도 소스 대조로 확인 — 정확하다.

## 요약

CHANGELOG·인라인 주석·신규 가드의 헤더 주석·테스트 rationale JSDoc 모두 이례적으로 충실하다 —
필드 제거(`latencyMs`)·이름 변경(`error`→`message`)마다 "왜"와 "실측 수치"를 남겼고, 정적 검사기의
원리적 사각지대(값 vs 선언 vs 선언 vs 선언)까지 명시했다. MDX 유저 가이드는 ko/en 쌍이 누락 없이
갱신됐고 은퇴·지어낸 에러 코드 참조가 실측으로 0건임을 재확인했다. 새로 추가된 `<ImplAnchor>` 사용은
기존 컨벤션·가드와 정확히 맞물리며 관련 테스트 스위트(13+243건)가 전부 GREEN 이다. 유일하게 남는
것은 spec 층(§8.3 실패 shape·§1 카탈로그·`user-guide-evidence.md §2.1`)의 갱신인데, 이는 developer
쓰기 권한 밖이라 정당하게 planner 트래커에 등재·유예됐고 그 처리 자체가 규약을 정확히 따랐다. 새로
CRITICAL/WARNING 급 문서 결함은 발견되지 않았다.

## 위험도

NONE
