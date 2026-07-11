# 정식 규약 준수 검토 — convention_compliance

- diff-base: `1682777fe..HEAD` (4 commits: `964e887af`, `428134b64`, `dedc411fd`, `52e244034`)
- worktree: `/Volumes/project/private/clemvion/.claude/worktrees/eia-client-context-types-33e771`
- 검토 대상: `spec/5-system/14-external-interaction-api.md` scope 의 impl-done diff (실제로는 client 타입·spec-link-integrity 가드 확장 diff)

## 발견사항

### [WARNING] `spec-impl-evidence.md §4.2` — `spec-link-integrity` 가드 스코프 서술이 현재 코드보다 좁게 stale
- target 위치: `spec/conventions/spec-impl-evidence.md` §4.2, `spec-link-integrity.test.ts` 행 — `codebase/{backend,channel-web-chat,packages}` 문구
- 위반 규약: `spec/conventions/spec-impl-evidence.md §4.2` 자신 (본 절이 "규약 SoT" 라고 스스로 선언) — 규약 서술이 실제 가드 구현과 일치해야 한다는 그 문서 자신의 존재 목적
- 상세: 실측 확인 결과, `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 의 `CODEBASE_SOURCE_ROOTS` 는 현재(HEAD) 4개 루트를 스캔한다.
  ```
  const CODEBASE_SOURCE_ROOTS = [
    "codebase/backend/src",
    "codebase/frontend/src",
    "codebase/channel-web-chat/src",
    "codebase/packages",
  ];
  ```
  이 `frontend/src` 항목은 커밋 `dedc411fd`(`refactor(docs,sdk): ai-review 반영 — 가드 실효성(SDK 배선·frontend 스캔·negative)`)에서 ai-review WARNING 대응으로 추가됐다(커밋 메시지: "W-scan-frontend 가드가 codebase/frontend/src 를 스캔에서 제외해 실제 깨진 링크 2곳...을 놓치고 있었다. frontend/src 를 CODEBASE_SOURCE_ROOTS 에 추가"). 그러나 `git diff origin/main..HEAD -- spec/conventions/spec-impl-evidence.md` 로 확인하면 이 문서에 대한 변경은 4 커밋 전체를 통틀어 **딱 한 번**(`428134b64`)이었고, 그 시점 서술("`codebase/{backend,channel-web-chat,packages}`")은 **그 커밋 시점의 코드와는 정확히 일치**했다. 이후 `dedc411fd` 가 스캔 대상을 확장했을 때 `spec-impl-evidence.md §4.2` 는 갱신되지 않아, 현재 HEAD 기준으로 "규약 SoT" 표가 실제 구현 스코프보다 좁게 서술된 채로 stale 됐다.
  - 오리엔테이션 payload 자체도 "scans codebase/{backend,frontend,channel-web-chat,packages}" 라고 (frontend 포함) 정확히 서술하고 있어, 이 문서 문구가 실측과 어긋난다는 점이 명확하다.
  - 실질 위험은 낮다(실제 가드는 frontend 도 보호하므로 under-claim 이지 false-safety 는 아니다) 그러나, 이 문서 자체가 "spec 약속 vs 구현" 갭을 막기 위한 SoT 라는 점에서 자기 모순적이다 — 바로 다음 §Rationale R-1 이 "stale 글로브는 이 가드만으로 검출 불가" 라 인정하는 정확히 그 클래스의 drift 다.
- 제안: `spec-impl-evidence.md §4.2` 의 `spec-link-integrity.test.ts` 행 문구를 `codebase/{backend,frontend,channel-web-chat,packages}` 로 갱신. `code:` frontmatter 는 변경 불필요(신규 파일 아님, `spec-links.ts`/`spec-link-integrity.test.ts` 이미 등재).

### [WARNING] 개발자 세션의 `spec/` 직접 편집 — CLAUDE.md 역할 경계 우회, 근거 재검토 필요
- target 위치: 커밋 `428134b64` 의 `spec/conventions/spec-impl-evidence.md` 편집 + 해당 커밋 메시지의 자기-예외 근거 서술
- 위반 규약: `CLAUDE.md` "Skill 체계" 표 — `개발자(developer)`: 쓰기 권한 `codebase/**, plan/**, review/**/RESOLUTION.md. spec/ read-only` / "spec/ 변경 → project-planner. codebase/ 변경 → developer." / "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임."
- 상세: 이 diff 는 성격상 코드 작업(client 타입 정밀화 + 가드 확장)이며 커밋 저자 role 은 developer 워크플로다. 그런데 `428134b64` 커밋 메시지가 스스로 인정하듯 "원칙상 spec 편집은 planner 몫" 인 `spec/conventions/spec-impl-evidence.md §4.2` 를 developer 세션이 직접 수정했다. 제시된 3개 근거를 개별 평가하면:
  1. "가드 확장이라는 구현 결정에 종속된 서술 정합화이지 신규 기획이 아니다" — CLAUDE.md 규칙 자체에는 "종속적 서술 정합화" 예외가 없다. 판단 기준("이건 사소한 sync 지 기획이 아니다")을 developer 스스로 내리는 것 자체가 역할 분리가 막으려는 지점이다(정의상 모든 우회 시도는 "이번엔 사소하다"고 스스로 정당화된다).
  2. "subagent write 가 worktree 격리로 막혀 위임 불가" — 이는 **다른 제약과의 혼동**이다. worktree 격리는 main 세션이 fan-out 하는 *Agent-tool subagent* 의 Edit/Write 가 main worktree 밖을 못 건드리는 제약(메모리 `feedback_subagent_write_isolation_worktree.md` 참조)이며, CLAUDE.md 가 실제로 지시하는 절차는 "developer 세션이 멈추고 **별도 project-planner 세션/worktree**로 넘긴다" 는 것이다 — 이는 subagent fan-out 이 아니라 세션/skill 전환이라 이 제약과 무관하다. 즉 "위임 불가" 라는 전제 자체가 틀렸다.
  3. "impl-done consistency check 가 사후 정합을 검증한다" — 사후 검증은 **사전 승인 게이트**(project-planner 의 `spec/` 쓰기 직전 `consistency-check --spec` 의무)를 대체하지 않는다. 오히려 이번 케이스가 정확히 그 사전 게이트가 있었다면 잡혔을 문제(가드 확장 후 서술 미동기화)를 뒤늦게 드러낸 사례다 — 바로 본 검토가 지금 하고 있는 일.
  - 결과적으로 이 우회가 실제로 낳은 결과(위 첫 번째 finding)가, 왜 이 경계가 존재하는지를 정확히 보여준다: developer 세션이 spec 텍스트를 코드에 "종속"시켜 직접 고치는 방식은, 후속 코드 변경(`dedc411fd`)이 같은 developer 세션 안에서 일어났음에도 그 spec 텍스트를 다시 동기화하지 못하는 실패로 이어졌다.
- 제안: (1) 즉시 조치로는 위 finding 1 을 project-planner 세션에 위임해 정정 — 이번 검토 결과 자체가 "developer 직접 반영" 이 실패한 사례이므로 같은 패턴(developer 직접 재수정)을 반복하지 않는다. (2) 절차 차원에서는, "가드 서술처럼 구현에 밀접 종속된 spec 절" 에 대해 정말 예외를 허용할 것인지 CLAUDE.md/skill 문서에 명시적으로 기록하거나(그렇다면 이번처럼 사후 stale 이 재발하지 않도록 후속 코드 커밋에도 "spec 서술 동반 갱신" 의무를 강제하는 장치 필요), 아니면 이 예외를 공식적으로 폐기하고 항상 project-planner 로 넘기도록 재확인. 현재 상태(비공식 self-granted 예외 + 강제 장치 없음)가 이번 drift 의 근본 원인이다.

## 통과 확인 (규약 준수 정상)

### (a) api-convention §5.4 부재 표현 — 정확히 준수
- `WaitingContextBase.conversationThread?: T` — `channel-web-chat/src/lib/eia-types.ts`, `packages/sdk/src/client.ts` 양쪽 모두 `| null` 없이 optional-key-omission 만 사용. `api-convention §5.4` 기준 (a)(다른 wire 표면과 형식 일치)에 정확히 해당하며, 두 파일 모두 JSDoc 에 "present-when-available... `| null` 아님" 근거를 명시(§5.4 링크 포함) — §5.4 "필드별로 근거를 명시" 요구를 충족.
- 봉투 `ExecutionStatus.context?: WaitingContext | null` — 기본 규칙(`null`, 키 present)을 따름. backend `ExecutionStatusDto.context?: ButtonsContextDto | NodeOutputContextDto | null` (`codebase/backend/src/modules/external-interaction/dto/responses.dto.ts:202`) 및 spec 본문 §5.3 예시(`"context": { ... } | null`)와 정확히 mirror.
- 판별자 없는 2-variant union(`buttonConfig`/`nodeOutput` 키 존재로 분기, `interactionType` 은 판별자 아님) 표현도 backend DTO(`WaitingContextBaseDto`/`ButtonsContextDto`/`NodeOutputContextDto`, `@ApiExtraModels` + `oneOf` no-discriminator, `swagger.md §1-4` 근거 주석 포함)와 client 3곳(`eia-types.ts`/`client.ts`/두 `.spec/.test.ts`) 이 정확히 동형.

### (b) spec-impl-evidence.md §4.2 편집 나머지 부분
- frontmatter `code:` 는 `spec-links.ts` + `spec-link-integrity.test.ts` 모두 diff 이전부터 이미 등재돼 있었고 신규 파일이 생기지 않았으므로 갱신 불필요 — 정확.
- "소스 스캔은 `spec/**.md` 를 가리키는 링크만" / "build 출력(dist/.next/build/node_modules) 제외" 서술은 `SPEC_MD_TARGET_RE`/`CODEBASE_SKIP_DIRS` 구현과 정확히 일치.
- 유일한 부정확 지점은 위 finding 1(루트 목록에 `frontend` 누락)뿐.

### (d) TS 타입/명명 규약
- `WaitingContextBase`/`ButtonsContext`/`NodeOutputContext`/`WaitingContext` — PascalCase, backend `XxxDto` 접미사를 뗀 client 대응 명명은 기존 확립된 패턴(`ExecutionStatusDto` → client `ExecutionStatus`)과 일관.
- `packages/sdk/src/client.ts` 의 신규 JSDoc 이 실제 markdown 링크(`[..](path)`) 대신 `[Spec EIA §5.3]` 평문 bracket 표기를 쓰는 것은 그 파일의 **기존 확립된 패턴**(예: 기존 line 17 `[Spec EIA §4 / §5]`)과 일관 — SDK 는 배포 패키지라 `spec/` 상대링크를 박지 않는 의도적 설계로 보이며 새 코드가 이를 정확히 따른다(불일치 아님).
- 노출값 3종(`form`/`buttons`/`ai_conversation`, `ai_form_render` 미포함)은 `spec/conventions/interaction-type-registry.md §1.1` 이 명시한 "EIA 외부 표면은 4→3 통합" 규칙과 정합.
- 내부 payload 필드(`buttonConfig`/`nodeOutput`)를 `Record<string, unknown>` 열린 map 으로 둔 것은 `swagger.md §1-4`("봉투만 스키마화, 내부는 열린 map")의 client-side 대응으로 적절.
- 두 패키지(`channel-web-chat`/`sdk`) 간 타입 정의가 구조적으로 복제(동일 이름, 다른 내부 타입 엄격도)되는 점은 본 리포에서 기존에 결정된 "미러 중복은 의도" 패턴(cafe24/makeshop 사례와 동일 클래스)과 일치해 별도 위반으로 보지 않음.

## 요약

핵심 타입 계약(§5.4 null-vs-omission, 판별자 없는 닫힌 union, 명명 패턴)은 spec·backend DTO·client 3-way 미러가 정확하다. 유일한 실측 문제는 `spec-impl-evidence.md §4.2` 의 `spec-link-integrity` 가드 스코프 서술이 후속 커밋(`dedc411fd`)의 `frontend/src` 확장을 반영하지 못해 stale 하다는 점이며, 이는 "빌드 안전성"에는 영향이 없으나(과소 서술이지 과대 서술이 아님) 이 문서 자신의 존재 목적(spec-vs-구현 정합 SoT)과 정면으로 모순되는 사례다. 절차적으로는, 이 stale 을 낳은 원인 커밋(`428134b64`)이 CLAUDE.md 의 명시적 "developer 는 spec/ read-only, 필요 시 project-planner 위임" 규칙을 self-granted 예외(근거 3개 중 최소 1개는 다른 제약과의 혼동)로 우회한 것으로 판단되며, 이번 drift 자체가 그 경계가 왜 존재하는지를 실증하는 사례로 보인다. 두 항목 모두 CRITICAL 수준의 즉각적 시스템 붕괴는 아니지만(실행 코드·계약에는 영향 없음), 문서 신뢰도와 절차 정합성 관점에서 WARNING 등급 정정이 필요하다.

## 위험도

MEDIUM

STATUS: SUCCESS
