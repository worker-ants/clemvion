# 문서화(Documentation) 리뷰 — Swagger DTO 계약 정합화 배치 (누적 diff, 4R)

## 검토 범위 메모

`origin/main..HEAD` 는 커밋 10개(`fefec2b27` ~ `fd5697f92`)다. 이 diff 는 이미 세 차례
code-review(`11_02_30`→1R, `11_44_16`→2R, `12_17_50`→3R)와 한 차례 consistency 검토
(`11_33_21`)를 거쳤고, 그 결과가 커밋으로 반영돼 있다. 이번(4R)에서 이전 라운드 대비 새로
추가된 실질 코드 변경은 최신 커밋 `fd5697f92` 뿐이다 — 경로 정규화 누락 4곳
(`engine-error-code-anchor-guard.ts:170,196`·`audit-action-binding.spec.ts:62`·
`websocket-events.types.spec.ts:311`) 수정, `temp-fixture.ts`/`temp-fixture.spec.ts` 의 async
reject 누출 방지, 그리고 무관했던 `execution-engine-residual-gaps.md` 편집 되돌리기다. 이
델타를 `Read`/`git show`/`git diff`로 직접 열어 대조했다(저장소에 아무것도 쓰지 않았다 —
`git status --short` 로 확인).

## 발견사항

- **[INFO]** `create-assistant-session.dto.ts` `llmConfigId` 설명이 여전히 명시적 `null` 케이스를 언급하지 않는다 — 1R·2R·3R 에서 이미 지적됐고 4R 인 이번에도 이 필드는 diff 대상이 아니라 그대로다
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:13` (`description: '사용할 LLM Config UUID. 생략 시 워크스페이스 기본값 사용'`)
  - 상세: 타입은 3R 이전에 이미 `string | null` 로 넓어졌는데 설명 문구는 "생략 시"만 언급한다. 자매 DTO `update-assistant-session.dto.ts:19` 는 같은 필드를 "null 전달 시 workspace default로 폴백"이라고 명시해 대조된다. 서비스 코드(`workflow-assistant-session.service.ts` `dto.llmConfigId ?? null`)가 생략과 명시적 `null`을 동등하게 처리하므로 설명이 틀린 것은 아니지만, 네 라운드 연속 같은 위치에서 같은 문구 개선 여지가 defer 된 상태다 — WARNING 승격 사유는 아니고 수렴 신호로 본다.
  - 제안: 여전히 급하지 않음. 다음에 이 파일을 편집할 기회가 있으면 `update-assistant-session.dto.ts` 문구를 그대로 가져와 통일할 것.

- **[INFO]** `nullable-type-lie-cast.spec.ts` 의 "모듈 스코프" 인라인 주석이 여전히 옛 표현을 유지한다 — 1R~3R 에서 이미 지적됐고 4R 커밋(`fd5697f92`)도 이 파일을 건드리지 않아 그대로다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:124` (`// 구현은 모듈 스코프의 \`withFiles\` — 단일 파일 호출은 그 얇은 래퍼다.`)
  - 상세: 바로 위 JSDoc(게이트 46-53)은 `withFixture` 가 `sharedWithFixture(content, fn, 'probe.entity.ts')`(공유 헬퍼 위임)라고 정확히 설명하는데, 124번째 줄 주석은 "모듈 스코프의 `withFiles`"라고 적어 로컬 함수라는 인상을 준다. 틀린 문장은 아니지만(import 바인딩도 모듈 스코프 식별자) 위 JSDoc과 어휘가 어긋난 채 네 번째 라운드째 남아 있다.
  - 제안: 여전히 사소함. "// 구현은 공유 헬퍼의 `withFiles`(import)"로 한 단어만 바꾸면 위 JSDoc과 일치한다.

- **[INFO]** 관측된 이상 상태 — 리뷰 대상이 아닌 파일이 워킹트리에서 미커밋 상태로 계속 수정돼 있음 (내 뮤테이션 아님, 2R·3R 리뷰에서도 동일 파일이 동일하게 관측·보고됨)
  - 위치: `review/consistency/2026/09/04/11_33_21/SUMMARY.md` — `git status --short` 결과 `M`(`git diff --stat` 42 insertions / 25 deletions).
  - 상세: 이번 리뷰는 `Read`/`Bash`(읽기 전용 `grep`/`find`/`git show`/`git diff`)만 사용했고 어떤 파일도 `Write`/편집하지 않았다. 2R(`11_44_16/documentation.md`)·3R(`12_17_50/documentation.md`) 문서화 리뷰가 이미 같은 파일·같은 현상("병렬 프로세스의 흔적일 가능성")을 보고했는데, 4R(이번 세션)에도 원복되지 않고 그대로 남아 있다 — 즉 이 미커밋 변경은 최소 세 리뷰 라운드에 걸쳐 지속된다. 확인·원복은 이 리뷰의 권한/스코프 밖이라 사실만 다시 보고한다.
  - 제안: 이 세션을 운영하는 오케스트레이터 쪽에서 committed 버전과 워킹트리 버전 중 어느 쪽이 최종 의도인지 정리할 것을 권장. 코드 리뷰 대상 diff 자체와는 무관하다.

## 긍정 관찰 (4R 신규 변경분 검증 — 발견사항 아님)

- **3R WARNING 3건이 소스와 커밋 메시지·`RESOLUTION.md`(`12_17_50`) 양쪽에 정확히 반영됨**을 확인했다:
  - W1(경로 정규화 "8곳 전부 통일했다"는 2R 주장이 거짓이었음) — `engine-error-code-anchor-guard.ts:173,199`(게이트 기준), `audit-action-binding.spec.ts:65`, `websocket-events.types.spec.ts:312` 전부 `toPosixRelative` 로 정규화됐고, 커밋 메시지가 "고친 것을 세고 결함은 안 셌다"는 검증 패턴 자체의 결함을 정확히 자기반증했다 — 근거·수치(4곳 발견, 수정 후 재측정 0건)가 코드·커밋·`RESOLUTION.md` 세 곳에서 일치한다.
  - W3(`temp-fixture.spec.ts` 의 "async 실패" 테스트가 실제로는 resolve 했던 결함) — `temp-fixture.ts:59-63` 에 `result.then(undefined, () => {})` 를 추가하고, 그 이유("무관한 다음 테스트로 전이" 방지)를 인라인 주석에 남겼다. `temp-fixture.spec.ts` 의 새 테스트(`async 콜백이 실제로 reject 해도...`)는 실제 reject 콜백 + `unhandledRejection` 리스너로 무방비 구간을 직접 겨눈다 — 뮤테이션 예측/실측(RED 1건/GREEN 6건)까지 `RESOLUTION.md` 에 기록돼 있다.
  - W2(무관한 plan 편집) — `execution-engine-residual-gaps.md` 가 이번 커밋에서 되돌려졌고, 현재 diff(파일 목록)에도 더 이상 포함되지 않는다 — `git show --stat fd5697f92` 로 직접 확인.
- **CHANGELOG 는 3R 내부 테스트 인프라 수정에 대해 항목을 추가하지 않았고, 이는 저장소 관례와 일치한다** — `CHANGELOG.md` 는 API/OpenAPI 계약(스키마 nullable/required)에 국한된 항목만 다루고(`invitedBy`·`ipWhitelist`·이번 9곳), 경로 정규화·async 레이스 방지 같은 순수 테스트 유틸 변경은 이전에도 대상이 아니었다.
- **`temp-fixture.ts` docstring 의 "8곳" 수치(게이트 300)는 여전히 정확하다** — 이 수치는 `path.relative(...).split(path.sep).join('/')` 리터럴 패턴의 **중복 개수**(2R 시점)를 가리키는 것이지, 3R 이 찾은 "정규화가 아예 없던 4곳"(다른 패턴, 다른 결함 클래스)을 포함하지 않는다. 두 수치는 서로 다른 질문에 대한 답이라 3R 이후에도 모순되지 않는다 — 다만 이 구분이 소스 docstring 에는 없고 커밋 메시지에만 있다는 점은 사소한 관찰이나, 두 수치를 헷갈릴 실익이 없어(둘 다 이미 0건으로 수렴) INFO 로도 등재하지 않는다.

## 요약

4라운드째 누적된 이 diff는 documentation 관점에서 CRITICAL/WARNING 급 결함이 없다. 이번 라운드의 유일한 신규 코드 변경(`fd5697f92`)은 3R 이 지적한 3건(경로 정규화 누락, async reject 누출, 무관한 plan 편집)을 정확히 조치했고, 그 조치의 근거·수치·자기반증("전부 통일했다"는 이전 주장이 검증 패턴 자체의 결함이었다는 것)이 커밋 메시지·인라인 주석·`RESOLUTION.md` 세 곳에서 일관되게 기록돼 있다 — 이 저장소가 반복적으로 보여 온 "실측을 숨기지 않는" 문서화 관례가 이번에도 유지된다. 남은 것은 세 라운드 연속 "급하지 않음"으로 defer된 INFO 2건(`llmConfigId` 설명 문구, "모듈 스코프" 주석 어휘)뿐이고 넷째 라운드에도 성격이 바뀌지 않아 수렴 신호로 판단한다. 추가로, 이 리뷰가 만들지 않은 워킹트리 이상 상태(`review/consistency/2026/09/04/11_33_21/SUMMARY.md` 의 미커밋 수정)가 최소 세 라운드에 걸쳐 지속되고 있음을 관측한 그대로 다시 보고한다 — 코드 리뷰 대상 diff 자체의 결함은 아니다.

## 위험도

LOW
