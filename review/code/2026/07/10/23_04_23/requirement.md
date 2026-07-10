# 요구사항(Requirement) 리뷰 — widget-presentation-restore

대상: `asEnvelope`(`presentation.ts`)의 `PresentationPayload.truncation` 흡수 fix + 복원 thread
presentation 렌더 회귀 가드(테스트 3파일) + 관련 spec 정정 3파일(`1-widget-app.md`,
`_product-overview.md`, `conversation-thread.md`).

## 검증 방법

- `codebase/channel-web-chat/src/lib/presentation.ts`(전체) / `conversation.ts`(전체) 를 직접 읽고 diff 와 대조.
- `npx vitest run src/lib/conversation.test.ts src/lib/presentation.test.ts src/widget/components/presentations.test.tsx` 실행 → **84 passed**, 실패 없음.
- plan(`plan/in-progress/widget-presentation-restore.md`)의 코드 위치 인용 6건(`conversation-thread.service.ts:107`,
  `execution-engine.service.ts:5459`, `table.handler.ts:160`, `render-tool-provider.ts:340-346`,
  `appendPresentationInteraction`, `assistant-presentations-block.tsx:316`)을 grep/Read 로 라인 단위 실측 대조 — 전부 일치.
- `spec/4-nodes/3-ai/1-ai-agent.md` §7.10 `PresentationPayload` type block, `spec/4-nodes/6-presentation/0-common.md`
  §10.4/§10.6/§10.7, `spec/conventions/conversation-thread.md` §2.1(신규 추가분) 을 코드·spec 갱신본과 대조.

## 발견사항

- **[INFO]** 위젯 truncation 배너는 `rowsTotalCount`/`itemsTotalCount`(잘리기 전 총 개수)를 사용자에게 노출하지 않음
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:198-204`(`toTable` — `truncated: boolean`만 반환),
    `codebase/channel-web-chat/src/widget/components/presentations.tsx:199`(`"일부 행만 표시됩니다."` 고정 문구)
  - 상세: `asEnvelope`가 `output`으로 흡수하는 필드는 `rowsTruncated|itemsTruncated|rowsTotalCount|itemsTotalCount` 전부이지만(주석에도 4개 모두 명시), `TableData`/`CarouselData` 는 `truncated: boolean`만 소비하고 count 는 버려진다. 메인 프런트엔드 `assistant-presentations-block.tsx:316-319`는 `p.truncation.itemsTotalCount ?? p.truncation.rowsTotalCount`를 배너에 함께 표시해 "N개 중 일부만 표시" 식 UX를 제공하는데 위젯은 그 count 를 보여주지 않는다.
  - 단, 이는 이 diff 가 만든 회귀가 아니다 — `TableData.truncated: boolean` 필드 자체가 이번 변경 이전부터 존재했고(diff 는 `asEnvelope`의 흡수 로직만 추가), spec `0-common.md` §10.4 도 "동등한 메타가 surface" 를 요구할 뿐 UI 문구에 count 표시를 강제하지 않는다. spec 위반은 아니며 코드 fix 대상도 아니다.
  - 제안: 필요하면 별도 후속 과제로 `TableData`/`CarouselData` 에 `totalCount?: number` 를 추가해 메인 FE 와 동일 UX 로 맞추는 것을 고려 — 이번 PR 스코프 밖.

- **[INFO]** `render_form`(type:`form`)이 `PRESENTATION_KINDS`에서 fast-path 제외되어 `classifyPresentation`이 `null` 반환 — 위젯 자체가 AI `render_form` 표시물을 렌더하지 않음
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:103-105`(`PRESENTATION_KINDS = Set(["carousel","table","chart","template"])`, `form` 제외)
  - 상세: spec `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 d.ii / §10.6 은 `render_form` 도 성공 시 `ai_assistant` turn의 top-level `presentations[]`(`type:'form'`)에 push된다고 규정하는데, 위젯 `presentations.tsx`에는 `form` 케이스 렌더러가 아예 없다(grep 결과 없음). 기존 테스트(`presentation.test.ts` "classifyPresentation — form 타입은 fast-path 제외 → null")가 이를 의도된 것으로 이미 고정해 두었다.
  - 이 diff 가 만든 변경이 아니며(사전 존재 동작, 수정 범위 밖), spec 자체도 위젯 렌더 요구를 명시하지 않아(위젯 spec `1-widget-app.md` §2 presentation 행은 carousel/table/chart/template 4종만 열거) 모순은 아니다. 참고용으로만 기록.
  - 제안: 조치 불필요(범위 밖). 향후 위젯이 `render_form`을 지원할 계획이면 별도 plan 필요.

## 세부 점검 결과

1. **기능 완전성**: `asEnvelope`가 `PresentationPayload.truncation`(payload 바깥 top-level)을 `output`으로 흡수하도록 1줄 수정. 복원 thread의 4종 presentation(carousel/table/chart/template) passthrough→분류→정규화→DOM 렌더 전 경로가 신규 프로브 테스트로 실측 확인됐고 실제로 무수정 상태에서도 통과함(plan §4-2 "TDD red 확인" 기재와 vitest 실행 결과 일치 — truncation 관련 2건만 실패했었고 나머지는 처음부터 통과). 완전 구현.
2. **엣지 케이스**: `truncation` 부재 시 `asRecord(undefined)={}`로 spread no-op(`presentation.test.ts` "truncation 없으면..." 케이스로 검증). `truncation.rowsTruncated=false`면 배너 미노출(오탐 배너 방지, "1MB 초과여도 실제 잘림 없으면" 케이스). `payload.rowsTruncated`(payload 내부 필드, 노드 envelope 의미)가 top-level truncation 부재 시에도 보존됨(overwrite 되지 않음 — config/output 모두 payload 사본이므로). text 없는 presentation-only 복원 turn도 메시지로 포함(`threadToMessages` 필터가 `text` OR `presentations.length>0`). 모두 커버.
3. **TODO/FIXME**: diff·커밋(`831ffb16a`) 전체 grep 결과 TODO/FIXME/HACK/XXX 없음.
4. **의도와 구현 간 괴리**: 없음. `asEnvelope` JSDoc이 새 `truncation?` 필드 흡수 이유·위치(payload 바깥)·근거 spec(§7.10/§10.4)를 정확히 서술하고 구현과 1:1 대응.
5. **에러 시나리오**: 입력 검증은 `asRecord`/`Array.isArray` 가드로 방어적(malformed payload는 조용히 빈 값으로 폴백) — 기존 패턴과 일관, 이번 diff가 새 실패 경로를 추가하지 않음.
6. **데이터 유효성**: `truncation.rowsTruncated === true` strict 비교로 boolean 이외 값(문자열 "true" 등) 오탐 방지. 기존 검증 패턴과 일관.
7. **비즈니스 로직**: "AI `render_*` truncation은 payload 바깥 top-level, standalone 노드는 output 내부 직접"이라는 §10.4/§4의 비대칭 규칙이 코드에 정확히 반영됨(else 분기는 흡수 로직 없음 — 이미 output 안에 있으므로 불필요, 실제로 `table.handler.ts:160-161`이 `payload.rowsTruncated`를 직접 세팅함을 확인).
8. **반환값**: `asEnvelope`/`toTable`/`toCarousel`/`toChart`/`toTemplate` 모든 분기에서 완전한 타입 형태 반환, `undefined`/부분 객체 반환 경로 없음.
9. **spec fidelity**:
   - `spec/4-nodes/3-ai/1-ai-agent.md` §7.10 `PresentationPayload` type block(`truncation?: { itemsTruncated?, rowsTruncated?, itemsTotalCount?, rowsTotalCount? }`, `payload`와 형제 필드) ↔ 코드 `asRecord(o.truncation)` 흡수 대상 필드명·위치 — **line-level 일치**.
   - `spec/4-nodes/6-presentation/0-common.md` §10.4("output.{itemsTruncated|rowsTruncated} 와 동등한 메타가 top-level presentations[i].truncation 에 surface") ↔ `asEnvelope`의 `output: {...payload, ...asRecord(o.truncation)}` — **일치**. 이번 fix는 R3 rationale대로 "spec은 이미 맞고 코드가 못 지키던 상태"를 바로잡은 것 — spec 변경 불요 판단이 타당함을 코드로 재확인.
   - `spec/7-channel-web-chat/1-widget-app.md` §2 presentation 행: "알려진 제약(Planned)…graceful 하게 무시(빈 렌더)" 서술을 "렌더러는 두 shape을 모두 수용…새로고침 복원 thread의 turn.presentations[]도 그대로 재현" + "범위 제약: durable thread는 source:'ai_assistant' 한정이라 AI render_* 표시물만 영속"으로 정정. 코드 실측(무수정 프로브 4종 전부 렌더 통과)과 정확히 일치 — **[SPEC-DRIFT] 태그에 해당하는 낡은 서술을 이번 PR이 직접 바로잡음** (아래 참고).
   - `spec/conventions/conversation-thread.md` §2.1 신규 단락("표시물({config,output} envelope)은 thread 에 영속되지 않는다…")이 SoT 컨벤션 문서에 추가되어, 선행 `/consistency-check`(22_27_45)가 지적한 WARNING(신규 확정 제약이 SoT 미등록)이 **같은 PR 내에서 해소**됨 — `git log`상 `28a358375`(spec 커밋)에 포함 확인.
   - `spec/7-channel-web-chat/_product-overview.md` §2 "비목표" 목록에 동일 제약 1줄 추가 — INFO 1 권고사항도 반영됨.

## [SPEC-DRIFT] 참고 (이미 이번 PR로 해소됨 — 별도 조치 불필요)

- **[SPEC-DRIFT]** `1-widget-app.md` §2의 구 서술("복원 thread presentation은 위젯이 graceful 하게 무시")은 실측과 어긋난 낡은 spec 문구였음(plan §1 "문구 출처: #874 자신이 실측 없이 추가"로 git 이력 확인됨) — 코드(`asEnvelope`의 `PresentationPayload` 분기, #707 도입)는 이미 옳았고 spec만 뒤처져 있었다.
  - 위치: `spec/7-channel-web-chat/1-widget-app.md` §2 presentation 행
  - 상세: 이번 PR이 `docs(spec)` 커밋(`28a358375`)에서 정확히 이 문구를 정정했으므로 **이미 해소됨**. 추가 조치 불필요 — 기록 목적으로만 명시.

## 요약

`asEnvelope`의 1줄 수정(`truncation` top-level 필드를 `output`으로 흡수)이 spec(`0-common.md` §10.4, `ai-agent.md` §7.10)이 이미 규정한 계약을 코드가 뒤늦게 충족시킨 것으로, 라인 단위 대조 결과 spec과 완전히 정합한다. 회귀 테스트(단위 84건 전부 통과, 실측 확인)가 "복원 thread 4종 렌더는 원래 동작했고 truncation 배너만 진짜 결함이었다"는 plan의 진단을 정확히 뒷받침하며, `#874`가 실측 없이 도입한 낡은 spec 문구(위젯이 복원 presentation을 무시한다는 서술)도 같은 PR에서 정정돼 spec-drift가 해소됐다. 선행 consistency-check가 지적한 유일한 WARNING(SoT 컨벤션 문서 미등록)도 `conversation-thread.md` §2.1 신설로 같은 PR 내에 해소됨을 확인했다. CRITICAL/WARNING 급 결함은 발견되지 않았고, 남은 두 INFO(총 개수 미노출, `render_form` 미지원)는 모두 이번 diff의 범위 밖 사전 존재 상태로 스펙 위반이 아니다.

## 위험도

NONE
