# 요구사항(Requirement) 리뷰 — output-shape.ts / output-shape.test.ts / output-shape-comment-followups.md

## 검증 방법
- `git show --stat edb6b3466` 로 대상 diff 가 프롬프트에 주어진 diff 와 정확히 일치함을 확인 (3 파일, +251/-58).
- `git diff ac42846f4 edb6b3466 -- output-shape.ts` 에서 comment 라인을 걸러낸 결과 **non-comment diff 0 줄** — 커밋 메시지의 "소스 로직 무변경" 주장을 실측 확인.
- `pnpm exec vitest run src/components/editor/run-results/__tests__/output-shape.test.ts` → **40/40 passed** (plan 이 주장한 개수와 일치).
- `pnpm exec vitest run src/components/editor/run-results` → 273 passed (인접 회귀 없음).
- `pnpm exec tsc --noEmit -p .` → output-shape 관련 에러 0.
- 신규 테스트를 손으로 트레이스: `isConversationOutput({config:{}, output:{result:{messages:[...], turnCount:1}}, meta:{model:'m'}})` — `raw.interactionType`/`conversationConfig` 없음(최상위 게이트 통과) → `unwrapNodeOutput` 이 `{config,output}` 매치로 구조화 → `hasResultMessages=true`, `endReason=undefined` → `looksLikeConversationEnd=false` → `hasLegacyMessages=false` → `isCanonicalWaiting=false` → 최종 `false`. 테스트 기대값과 일치, 주석이 서술한 고립 조건(6개 필드 부재)도 fixture 와 정확히 부합.
- JSDoc/plan 이 인용한 근거 라인 실측: `output-shape.ts:202` (`typeof endReason === "string"` conjunct) 정확히 일치. `result-detail.tsx:1006,1052` / `result-timeline.tsx:73` 의 `isConversationOutput` 호출 3곳 정확히 일치. `executions.ts:27` 의 `outputData: Record<string, unknown> | null` 타입 정확히 일치. `spec/conventions/conversation-thread.md` §9.9(618~635줄 구간)에 Inv-8 테이블 행 존재 확인. `lib/api/` 전체 zod import 0건 확인. `plan/complete/is-conversation-output-restructure.md` 존재 확인.

## 발견사항

- **[INFO]** plan 문서 내 spec 인용 링크가 실제 파일 위치와 어긋남 (api-convention.md)
  - 위치: `plan/in-progress/output-shape-comment-followups.md` "기각 근거 (실측)" 표 3번째 행 — `[swagger.md §1-4 / api-convention §5.4](../../spec/conventions/)`
  - 상세: 이 markdown 링크(`../../spec/conventions/`)는 두 문서(`swagger.md`, `api-convention.md`)를 한 링크로 묶어 가리키지만, `api-convention.md` 는 `spec/conventions/` 가 아니라 `spec/5-system/2-api-convention.md` 에 있다(실측: `find spec -iname "*api-convention*"`). `swagger.md` 만 그 디렉터리에 실존한다. 인용 내용 자체("`interactionType` 은 unsound 판별자")는 `swagger.md:107,356` 에 정확히 근거하므로 사실관계는 맞지만, 링크 target 이 `api-convention §5.4` 부분을 찾을 수 없는 경로를 가리킨다.
  - 제안: 코드 결함은 아니며 plan 문서 정확도 이슈. 다음 이 plan 파일을 편집할 기회에 링크를 `spec/5-system/2-api-convention.md#5-4-...` 로 분리 수정 (본 reviewer 는 spec/plan 직접 수정 금지 범위 밖이지만 plan 파일은 developer 권한이므로 developer 가 후속 처리 가능).

## 항목별 점검 요약

1. **기능 완전성** — 이 변경은 논리 변경이 아니라 (a) `plan/in-progress/output-shape-comment-followups.md` 가 정의한 4개 이월 항목 중 항목 2(음성 테스트 1건 추가: 39→40)·항목 3(주석 정리 4곳)만 코드에 반영하고, 항목 1·4는 plan 문서 내 NO-GO 판정(근거 포함)으로 처분한 구조. 커밋 메시지·plan 체크리스트·실제 diff 가 서로 정확히 일치한다. `git diff` non-comment 라인 0 줄로 "소스 로직 무변경" 주장을 실측 재확인 — 의도한 범위를 벗어난 변경 없음.
2. **엣지 케이스** — 신규 테스트가 "endReason 키 자체가 부재"라는, 기존 `bogus_value`(화이트리스트 밖 값) 테스트와 다른 케이스를 명시적으로 커버. 손 트레이스로 fixture 가 실제로 판정 함수의 모든 다른 분기를 거짓으로 고립시킴을 확인(위 "검증 방법" 참조).
3. **TODO/FIXME** — diff 전체에서 TODO/FIXME/HACK/XXX 없음. plan 체크리스트에 `[ ] /ai-review + Critical/Warning 반영` 미체크 항목이 남아있으나 이는 "본 리뷰가 수행되면 체크될" 정상적인 워크플로 상태이지 미완성 코드 표식이 아님.
4. **의도와 구현 간 괴리** — JSDoc/테스트 주석이 실제 소스 라인(202번째 줄의 `typeof endReason === "string"` conjunct, OR-체인 6분기, AND-guard 4곳)과 정확히 대응함을 실측 확인. "JSDoc 이 근거의 SoT, 테스트 주석은 고립 조건만" 이라는 위임 규약이 실제로 관철됨(테스트 주석에서 근거 서술 대신 JSDoc 참조로 축약된 패턴 일관).
5. **에러 시나리오** — 순수 함수(`isConversationOutput`)라 예외 발생 경로 없음. 모든 분기가 `boolean` 을 반환하며 이번 변경으로 반환 경로 자체는 무변경.
6. **데이터 유효성** — plan 문서가 "discriminated union 재설계"를 NO-GO 처리한 근거(frontend API 레이어에 런타임 검증 0건, `interactionType` 이 unsound 판별자, total parser 요구사항)가 실측(zod import grep 0건, swagger.md 인용)으로 뒷받침됨. 결정 자체가 근거 있는 판단이며 기각이 안일하지 않음.
7. **비즈니스 로직** — `CONVERSATION_END_REASONS` 화이트리스트의 SoT 가 `@workflow/ai-end-reason` 패키지라는 기존 정책(PR #968)을 그대로 유지, 이번 변경은 그 정책을 문서화(JSDoc 한국어화)했을 뿐 값 도메인 변경 없음.
8. **반환값** — `isConversationOutput`/`unwrapNodeOutput` 등 모든 함수가 이전과 동일하게 모든 경로에서 값을 반환(무변경 확인).
9. **spec fidelity** — `spec/conventions/conversation-thread.md` §9.9 Inv-8 인용이 정확(라인 632 테이블 행, §9.9 섹션 619~635 범위 내). `swagger.md` §1-4 unsound-discriminator 인용도 정확(라인 107, 356). 유일한 흠은 위 INFO 항목(plan 문서의 `api-convention §5.4` 링크 target 부정확) — 코드나 spec 본문 자체의 불일치가 아니라 plan 문서의 상대경로 링크 오류.

## 요약
3개 파일(`output-shape.test.ts`, `output-shape.ts`, 신규 plan 문서) 모두 실측 검증 결과 매우 견고하다. `output-shape.ts` 변경은 JSDoc 한국어화·구조 개선뿐이며 non-comment diff 가 0줄임을 직접 확인했다. 신규 테스트("endReason 키 부재")는 손 트레이스로 기대 동작과 정확히 일치하며, `bogus_value` 테스트와 겹치지 않는 새 mutation 클래스(타입 에러 은폐형 리팩터)를 실제로 커버한다. plan 문서의 모든 정량적 주장(테스트 개수, 호출부 라인 번호, 인용 spec 섹션, zod import 0건 등)을 재현·재검증했고 전부 사실과 일치했다 — 유일한 흠은 plan 문서 내 `api-convention §5.4` 링크가 실제 파일 위치(`spec/5-system/2-api-convention.md`)가 아닌 `spec/conventions/` 를 가리키는 사소한 경로 오류(INFO, 코드/spec 무관). 요구사항·엣지케이스·spec 정합성 모든 관점에서 차단 사유 없음.

## 위험도
NONE
