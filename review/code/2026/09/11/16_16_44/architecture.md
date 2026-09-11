# 아키텍처(Architecture) 리뷰

## 검증 방법 (요약)

이번 라운드의 diff base 는 `2ae81077c`(T1 이동) + `6dc2b7d60`(drift 등재 fix + 전용 테스트 신설) +
`81d2a8c18`(현재 `HEAD`, 뮤테이션 커버리지 공백 보강)를 누적한다. 프로덕션 코드 변경은
`chat-channel-input-rules.ts` 에 JSDoc 6줄 추가(discord verify_key 예외를 소스 자체에 각주로 명시)뿐이고,
`triggers.service.ts` 는 `6dc2b7d60` 이후 한 글자도 바뀌지 않았다(`git diff 6dc2b7d60 81d2a8c18 --
.../triggers.service.ts` 출력 없음). 실질 변경은 `chat-channel-input-rules.spec.ts`(+91/-8) —
provider 분기를 `it.each` 로 slack/discord 대칭화하고 교차 길이 케이스(정규식 스왑 검출)·필드 부재
분기·`mode==='update'` 공개 진입점 디스패치·`chatChannel===undefined` 조기 반환·
`assertChatChannelAlreadySetUp` 양성 경로를 추가한 테스트 전용 변경이다.

이전 두 라운드(`review/code/2026/09/11/15_31_54`, `15_57_42`)가 이미 이 이동의 구조(0-의존 순수
함수 추출, `triggers/` 내부 잔류로 `#676` 순환 회피, 오버로드로 `mode`↔DTO 컴파일 타임 결속)를
architecture 관점에서 상세 검증해 WARNING 1건(spec 귀속 drift 미추적)을 냈고, 그 WARNING 은
`6dc2b7d60`(트래커 신규 등재 · plan 취소선 정정 — `plan/in-progress/spec-draft-nullable-notation-followups.md:2523-2534`)
으로 해소된 상태다. 이번 라운드에서 `grep`/`Read` 로 재확인했다:

- `forwardRef` 잔존 0건(`triggers.module.ts:37` 주석 1건만, 실제 사용 없음) — 순환 의존 재발 없음 유지.
- `chat-channel-input-rules.ts` → `chat-channel/` 역방향 import 없음(단방향 유지).
- 이전 라운드 INFO(`translateSetupChannelError` 스코프 불일치, provider 분기 `switch`+`assertNever`
  미채택)는 신규가 아니며 `spec-draft-nullable-notation-followups.md:2536-2560` 에 근본 처방과 함께
  등재된 상태를 유지한다(이번 라운드가 새로 만든 것도, 방치한 것도 아님).

이번 라운드에서 새로 도입된 아키텍처 관점의 문제는 발견되지 않았다.

## ⚠️ 저장소 상태 이상 — 뮤테이션 잔존 (내 것 아님, 원복하지 않음)

리뷰 도중 `git status --short` 로 확인한 결과, 커밋되지 않은 수정이 하나 남아 있다:

```
 M codebase/backend/src/modules/triggers/chat-channel-input-rules.ts
```

`git diff -- codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 로 내용을 확인하면
`assertChatChannelInputSafe` 의 내부 필드 차단 3개 분기(`botTokenRef`/`inboundSigningRef`/
`inboundSigning`)에 각각 `mode === 'create' &&` 조건이 추가돼 있다 — `mode==='update'` 에서 이 세
내부 필드 차단이 무력화되는 뮤테이션이다. 이 변경은 내가 만든 것이 아니다: 이 리뷰 세션 시작 시
`Read` 로 확인한 파일 원문(`HEAD`=`81d2a8c18` 상태)과 방금 확인한 `git diff` 사이에 이 조건절이
새로 나타났다 — 병렬로 도는 다른 reviewer 가 같은 워킹트리에서 뮤테이션 검증을 수행 중이거나
직전에 수행하고 원복에 실패한 것으로 보인다.

본 리뷰 규약("저장소 트리 안에 아무것도 쓰지 마세요", "`git checkout`/`restore`/`stash` 금지")에
따라 **이 상태를 되돌리지 않았다.** 내가 만들지 않은 미커밋 변경을 지우는 것 자체가 금지된
동작이기 때문이다. 이 보고서의 모든 분석은 이 뮤테이션을 배제하고 `HEAD`(커밋된 상태)를
기준으로 수행했다. orchestrator/다음 라운드는 이 잔존 뮤테이션이 실제 결함이 아니라 다른
reviewer 의 검증 부산물임을 인지하고 원복 여부를 판단해야 한다.

## 발견사항

이번 diff 범위(테스트 전용 확장 + JSDoc 추가)에서 SOLID·결합도/응집도·레이어 책임·디자인
패턴·순환 의존·추상화 수준·모듈 경계·확장성 8개 관점 모두 새로 지적할 사항이 없다. 테스트
구조(`it.each` 로 slack/discord 대칭 처리, 교차 길이 케이스로 판별자를 명시)는 프로덕션 코드의
provider 분기 구조를 있는 그대로 반영해 테스트-구현 간 결합이 적절하다.

이전 라운드에서 이미 식별되어 durable 트래커(`spec-draft-nullable-notation-followups.md`)에
등재된 항목(에러 봉투 생성 중복 7회 → `throwValidationError` 헬퍼, `translateSetupChannelError`
파일 스코프 불일치, `256` 매직 넘버, 이중 캐스팅 헬퍼화, 인접 주석 2곳 정정)은 이번 라운드에서도
그대로 유효하지만 새로 조치할 필요는 없다 — 전부 비차단(INFO/WARNING)이고 추적 중이다.

## 요약

이번 라운드는 프로덕션 로직을 사실상 변경하지 않고(JSDoc 6줄 추가) 테스트 커버리지 공백을
메우는 fix 커밋이다. 앞선 두 라운드가 검증한 아키텍처 설계(0-의존 순수 함수 추출, 순환 의존
회피, 오버로드를 통한 컴파일 타임 계약 결속, spec 귀속 drift 트래커 등재)는 그대로 유지되고
재검증에서도 무너지지 않았다. 이번 라운드가 새로 만든 아키텍처 문제는 없다. 다만 리뷰 도중
저장소에 이 세션이 만들지 않은 미커밋 뮤테이션(`chat-channel-input-rules.ts` 의 `mode` 가드
조작)이 관측됐다 — 병렬 리뷰어의 검증 부산물로 추정되며, 원복하지 않고 그대로 보고한다.

## 위험도

NONE
