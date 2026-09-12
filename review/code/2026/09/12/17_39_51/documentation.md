# 문서화(Documentation) 리뷰

## 점검 방법

`chat-channel-input-rules.{ts,spec.ts}` · `chat-channel-rejection-messages.const.ts` ·
`dto/chat-channel-config.dto.ts` · `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`(신규) ·
`dto/trigger-dto-validation.spec.ts` · `triggers.controller.ts` · `triggers.service.ts` ·
`repo-guards/__tests__/dto-class-name-collision{-guard,}.ts`(신규) + fixture 3개, `plan/in-progress/*.md`
2건을 `Read`로 전문 열람했다(diff가 프롬프트 예산으로 절단된 파일 포함). 아래 항목을 실측으로
대조했다 — 지어내지 않고 전부 `grep`/`Read`/`git show`/`git log`로 검증:

- JSDoc의 사실 주장(카운트·단계 수·인용 경로)이 실제 코드·이력과 일치하는가
- 신설 spec/convention 인용(§ 번호)이 실제로 그 절에 존재하는가
- "고쳤다"고 적은 comment가 실제 코드 상태와 일치하는가(stale comment 재발 여부)
- 신규 guard 파일(`dto-class-name-collision*`)의 자기 서술(대상 범위·베이스라인 수치)이 실측과 맞는가

주요 검증 결과:

| 주장 | 위치 | 검증 |
|---|---|---|
| `throwInvalidField` 대상 "11곳" | `chat-channel-input-rules.ts` 헤더 JSDoc(44-46행) | 실제 호출부 카운트와 일치(plan §착수 전 재판정 표와도 일치) |
| `rotateBotToken`이 "6단계" | `triggers.controller.ts:251` JSDoc | `triggers.service.ts`의 번호 주석 `// 1.`~`// 6.` 6개로 확인 |
| `*.dto.ts` "256개 클래스"·"114개 파일" | `dto-class-name-collision.spec.ts:38` | `find … -name '*.dto.ts' \| wc -l` → 114, `export class` 총합 → 256. 정확히 일치 |
| `OmitType(ChatChannelConfigDto, ['botToken','inboundSigningPlaintext'])`이 `provider` `@IsIn`을 상속 | `chat-channel-input-rules.ts:215-217`, `trigger-dto-validation.spec.ts` 신규 JSDoc | 실제 DTO 선언과 일치, 신규 테스트가 그 주장을 실제로 고정함(도달 불가 근거가 vacuous 하지 않음) |
| §5.4/§5.4.1/§5.4.1.2/R-CC-21/R-CC-23 등 SoT 인용 | 다수 파일 | 전부 `spec/5-system/15-chat-channel.md`에 실재하는 절/근거 |
| `swagger.md §5-1`(응답 DTO 위치 규약) · `§3`(JSDoc→공개 description) | `dto/responses/*.ts` 헤더 주석 | 두 절 모두 실재, 내용도 정확히 인용대로("`dto/responses/*-response.dto.ts`", "`introspectComments`로 JSDoc이 공개 description이 된다") — `nest-cli.json`에서 `introspectComments: true` 확인 |
| `review-citations.md §3` | 위와 동일 파일 | 실재("적용 범위 — 맥락 없이 읽히는 자리") — 리뷰 인용을 JSDoc이 아닌 `//`에 두는 근거로 정합 |
| `dto-jsdoc-citation`이 "기존 위반 2건 동결" | `dto-class-name-collision.spec.ts:37` | `dto-jsdoc-citation.spec.ts`의 `EXPECTED_DTO_JSDOC_CITATIONS` 배열 원소 2개와 정확히 일치 |
| `chat-channel-rejection-messages.const.ts:8-10` — 가드가 이제 "module-level 함수"이고 서비스는 호출만 함 | 갱신된 주석 | `chat-channel-input-rules.ts`에서 `export function`으로 선언, `triggers.service.ts`는 호출만 함을 확인 — stale 재발 없음 |
| `dto/chat-channel-config.dto.ts` 두 곳의 "TriggersService가 수행" stale 언급 | 헤더 JSDoc·`inboundSigningPlaintext` description | 둘 다 `chat-channel-input-rules`/`assertInboundSigningPlaintextByProvider`로 정확히 갱신됨 |

## 발견사항

없음 — CRITICAL/WARNING 없음.

검토 중 잠재 후보 두 건을 조사했으나 모두 결함이 아님을 확인해 기록만 남긴다(오탐 방지 근거):

1. `ChatChannelRotateBotIdentityDto.botId`의 JSDoc(`dto/responses/chat-channel-rotate-bot-token-response.dto.ts:36-41`)이 내부 어댑터 파일명(`slack.adapter.ts`/`discord.adapter.ts`)과 내부 헬퍼명(`hashStringToInt`)을 언급한다 — 이 JSDoc은 `introspectComments`로 공개 OpenAPI description에 실린다. 이 파일 자신의 머리말(17-18행)과 `publicKey` 필드 주석(53-59행)이 "내부 서사는 `//`, JSDoc은 소비자용"이라는 원칙을 명시하는 바로 옆이라 처음엔 자기모순으로 의심했다. 그러나 저장소 전체를 훑은 결과 `execution-response.dto.ts`(`shared/utils/redact-stored-error.ts` 언급) · `model-config-response.dto.ts`(`llm/interfaces/llm-client.interface.ts` 언급)가 이미 같은 패턴을 쓴다 — "필드 값의 유래를 설명하는 내부 참조"는 이 저장소에서 이미 정착된 관행이지, 이 PR이 새로 어긴 규칙이 아니다. INFO로도 등재하지 않는다.
2. `plan/in-progress/chat-channel-rules-cleanup.md`의 `## 체크리스트`가 대부분 `[ ]`인데(예: `1~4 (프로덕션)` · `6 (swagger)` · `` `run-test-all.sh` 4단계 `` · `` `/ai-review` + `--impl-done` ``) 실제로는 이 라운드까지 전부 수행된 상태다(각 라운드 RESOLUTION.md의 TEST 섹션이 `ALL PASS`를 반복 기록). 처음엔 체크박스-실제상태 불일치로 의심했으나, 이 저장소의 정착된 관례가 "체크+`complete/` 이동은 리뷰 종료 뒤 마무리 커밋에서 함께 한다"이므로(같은 plan 문서의 체크리스트 마지막 두 항목이 그 순서를 명시), 리뷰 in-flight 라운드에서 미체크 상태인 것은 정상이다. 결함 아님.

## 요약

이번 diff는 문서화 관점에서 이례적으로 견고하다 — 모든 신규/변경 JSDoc·주석의 사실 주장(호출 횟수·단계 수·클래스/파일 카운트·spec 절 번호·타 파일 인용)을 전수 재실측했고 전부 일치했다. 과거 라운드(16:17:57~17:23:34)가 지적한 stale comment(`TriggersService` 귀속 3곳)·JSDoc/공개 문서 분리 위반(`publicKey` 필드)·swagger 응답 문서 누락은 이번 최종 상태에서 모두 정확히 해소되어 있고, 재발도 없다. 신규 가드 파일(`dto-class-name-collision*`)은 왜 필요한지·무엇을 세는지·베이스라인이 왜 0인지를 소비자(다음 리뷰어)가 재구성할 수 있게 적었고 그 수치(114/256/2)도 실측과 일치한다. README/CHANGELOG 갱신은 이 PR 범위에 해당하지 않는다 — 응답 형태를 바꾸지 않는 순수 리팩터 + 기존에 이미 그렇게 동작하던 응답의 swagger 문서 보강(additive-only)이라 CHANGELOG.md(이 저장소는 "동작 변경"에 한해 기록하는 관례)에도, 별도 README에도 해당 사항이 없다. 새 환경변수·설정 옵션도 없다. CRITICAL/WARNING 없음.

## 위험도

NONE
