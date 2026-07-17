# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[WARNING]** CHANGELOG.md 의 기존 "웹채팅 위젯" Unreleased 항목이 이번 유령 표면(ghost surface) 부활 버그 fix 를 반영하지 않음
  - 위치: `CHANGELOG.md` L3-L12(`## Unreleased — 웹채팅 위젯: 버퍼 만료 재동기화 + 종료 처리 일원화`), 특히 항목 4(L10)
  - 상세: 바로 직전 커밋(`7a9b4ce88`, "cross-session stale 410 오종료 fix")의 커밋 메시지는 "W7: CHANGELOG Unreleased 항목 추가 — 실사용자 관측 가능 변경... 인데 4커밋 체인 전체가 미기록이었다"는 ai-review 지적을 반영해 바로 이 CHANGELOG 섹션을 신설한 것이다. 그런데 이번 커밋(`3b54c8727`, "staleness 가드 4종 → worldGen 단일화 + 유령 표면 버그 fix")은 커밋 메시지 자체가 "재현된 잔존 버그(4라운드 리뷰도 못 잡음): 버퍼 만료 seed in-flight 중 SSE terminal 도착 → ... 종료된 위젯이 awaiting_user_message 로 부활. 입력창이 다시 뜨고 sessionRef 가 살아있어 명령까지 서버로 나간다. 실측 재현 확인"이라고 명시할 만큼 명백히 사용자 가시적인 회귀 버그를 고쳤다. 그럼에도 `CHANGELOG.md` 는 이 커밋에서 전혀 수정되지 않았다(`git show 3b54c8727 -- CHANGELOG.md` 결과 무변경). 게다가 기존 항목 4("cross-session staleness 가드... 옛 세션의 지연 응답이... 유령 표면을 그리지 않는다")는 이 fix 이전에는 실제로 성립하지 않았던(재현 확인된 반례가 있는) 문구가 되어 있어, 현재 상태 그대로 두면 CHANGELOG 독자에게 부정확한 보장을 전달한다. 직전 커밋에서 한 번 지적·수정됐던 동일 패턴(사용자 가시 변경의 CHANGELOG 누락)이 바로 다음 커밋에서 반복된 사례다.
  - 제안: 기존 "Unreleased — 웹채팅 위젯" 섹션에 5번째 항목을 추가해 "seed in-flight 중 SSE terminal 도착 시 종료된 위젯이 부활하던 버그"와 `worldGenRef` 단일화(4종 staleness 가드 → 1종)를 기록한다. 항목 2와 같은 "(사용자 가시 버그 수정)" 표기 패턴을 재사용 권장. 필요하면 항목 4 문구도 "이제는" 식으로 갱신.

- **[WARNING]** `worldGenRef` JSDoc 계약의 "무효화 지점은 두 곳뿐" 서술이 실제 코드와 불일치
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L141("무효화 지점은 두 곳뿐이다 — `teardownSession()`... 과 언마운트 cleanup") vs L402(`start()` 내부 `const gen = ++worldGenRef.current;`)
  - 상세: 이번 diff 가 새로 작성한 `worldGenRef` 의 JSDoc(L109-L131, "world 세대 토큰 — 비동기 staleness 의 단일 진실")은 "세계를 무효화하는 모든 지점"을 `teardownSession()`과 언마운트 cleanup **두 곳**으로 명시적으로 못박는다. 그러나 실제 코드에서 `worldGenRef.current` 를 증가시키는 지점은 3곳이다 — `teardownSession()`(L182) · `start()`(L402) · 언마운트 cleanup(L746). `start()` 의 증가는 이번 diff 가 함께 갱신한 바로 위 인라인 주석에서 "`++` 인 이유: start 는 세계를 **교체**하므로(옛 execution 을 새것으로) 진행 중인 다른 비동기도 함께 무효화해야 한다"고 스스로 invalidation 의도를 명시하고 있어, 상위 계약 문서의 "두 곳뿐" 서술과 같은 파일·같은 diff 안에서 정면으로 모순된다. (현재 `startedRef`/`sessionRef`/`cfg`·`client` null 가드 구조상 `start()` 의 증가가 실제로 다른 in-flight 비동기를 무효화하는 시나리오가 지금 당장 재현 가능한지는 불확실하나, "가드가 몇 종·몇 곳인지 헷갈려 대칭 누락 버그가 반복됐다"는 것이 바로 이 리팩터의 동기였던 만큼, 계약 문서 자체의 지점 수 불일치는 이 리팩터의 취지와도 어긋난다.)
  - 제안: "두 곳뿐이다"를 "세 곳"으로 정정하거나, `start()` 의 증가를 "world-교체용 자기 세대 캡처(부수적으로 무효화 효과 겸함)"로 계약 절에 명시해 두 서술을 일치시킨다.

- **[WARNING]** 테스트 파일의 기존(비변경) 주석이 이번 rename 범위에서 누락됨 — 존재하지 않는 식별자 잔존
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` L216
  - 상세: "복원된 세션이 이미 terminal → ENDED 전이 + SSE 미오픈 + storage 부활 없음" 테스트 바로 위 JSDoc 주석이 "`start()` 는 startGenRef 로 우연히 보호됐으나 이 경로는 무방비였다"라고 여전히 `startGenRef` 를 지칭한다. 이번 diff 가 `use-widget.ts` 전역에서 `startGenRef` → `worldGenRef` 로 rename 했고, **동일 문구**가 `use-widget.ts` 내부(세션 복원 분기 주석, applyConfig)에서는 이미 "`start()` 는 세대 가드로 우연히 보호됐으나 이 경로는 무방비였다"로 정정되었다(diff에서 확인 가능). 테스트 파일의 거울 주석만 갱신에서 빠져, `startGenRef` 로 코드베이스를 grep 하면 이제는 존재하지 않는 심볼을 가리키는 이 주석만 남는다.
  - 제안: L216 의 "startGenRef" → "세대 가드"(또는 "worldGenRef")로 교체해 `use-widget.ts` 의 대칭 문구와 맞춘다. 기능에는 영향 없는 사소한 건이나, 이번 PR이 다른 곳에서는 동일 문구를 꼼꼼히 맞췄기 때문에 누락이 도드라진다.

## 요약

이번 변경(`use-widget.ts` 의 `startGenRef`/`sessionRef` 동일성/`cancelled` 지역 플래그 3종 staleness 가드를 `worldGenRef` 단일 세대 토큰으로 통합 + 회귀 테스트 + plan 문서 갱신)은 문서화 수준이 전반적으로 매우 높다. 신설된 `worldGenRef` JSDoc 은 계약·무효화 지점·과거 3종 가드가 왜 실패했는지·재현된 버그·`endedRef` 와의 축 분리까지 상세히 설명하고, 코드 내 다수의 기존 인라인 주석도 rename 에 맞춰 꼼꼼히 갱신됐으며(다른 유사 문구들은 정확히 동기화됨), eslint-disable 근거까지 남기는 등 모범적이다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 는 "구조 개선 — worldGen 단일화" 절로 이번 리팩터의 배경·기각한 대안(`useEiaStream` 분리)·검증(mutation 3종)까지 결정 이력을 잘 남겼고, 신규 회귀 테스트의 JSDoc 도 재현된 버그를 정확히 설명해 코드·테스트·plan 세 문서 간 서술이 일관된다. 다만 (1) 직전 커밋에서 한 번 지적·수정됐던 "사용자 가시 변경의 CHANGELOG 누락" 패턴이 이번 커밋(그 자체가 사용자 가시적인 유령 표면 부활 버그를 고침)에서 다시 나타났고, (2) 새로 작성한 JSDoc 계약이 자기 파일 안에서 실제 코드(무효화 지점 3곳 vs 서술 2곳)와 어긋나며, (3) 이번 rename 이 놓친 테스트 파일 내 오래된 식별자(`startGenRef`) 주석 1건이 남아있다. 셋 다 기능에 영향 없는 저비용 수정 건이며 전체적으로 완성도 높은 문서화 작업이다.

## 위험도

MEDIUM
