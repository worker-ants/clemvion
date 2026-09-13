# Plan 정합성 검토 — `spec/conventions/` (impl-done, diff-base=origin/main, 라운드 9)

## 검토 대상 요약

이 diff 는 `error-code-emission-axis` plan(라운드 1~8, HEAD `061f5153f`)의 산출물이다.
`spec/conventions/` 자체 델타는 0(정상 — 코드 전용 PR, `spec_impact: none`)이고, 실제 코드
변경은 `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`(발행 축 신설 +
라운드 8 수정) · `logic{,.en}.mdx`(가이드 문장 2건 정정) · `CHANGELOG.md`/`PROJECT.md` 다.

`plan/in-progress/error-code-emission-axis.md` 와 그 배치가 닫는 트래커
(`plan/in-progress/spec-draft-nullable-notation-followups.md`)를 최신 HEAD 기준으로
다시 대조했다. 8라운드 동안 `plan_coherence` 는 NONE~LOW 로 수렴해 왔고, 직전 라운드
(`review/consistency/2026/09/13/22_06_21`)의 WARNING(형제 트래커 항목 `:3332` 의 stale
실측치)은 이번 커밋에서 361→601→**622** 갱신표로 실측·해소를 확인했다(직접 재계산해
622/439/156/27 일치 확인). 미해결 결정(카탈로그 backfill vs 메시지-접두 표기 택일,
`CONTAINER_*` 6파일 spec 정정)은 여전히 코드로 우회되지 않고 트래커에 양방향으로 위임돼
있으며, 코드 쪽 등록(`GUIDE_NON_EMITTED_VOCABULARY`)은 그 택일 어느 쪽이 나와도 깨지지
않는 구조(카탈로그 필터가 등록 필터보다 먼저 걸린다, `computeNonEmittedOffenders` 확인)다.

아래는 지금까지 어느 라운드도 짚지 않은 새 발견이다.

## 발견사항

- **[WARNING]** 라운드 8이 CRITICAL(예고문 미정정)을 고치며 새로 단 근거 인용이, 같은 커밋의 다른 편집 때문에 이미 어긋난 줄을 가리킨다
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:94`
    (`// > \`spec-draft-nullable-notation-followups.md:3407\`).`)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` — 현재
    실제 3407행은 무관한 항목("선언은 있는데 결코 발행되지 않는 \"유령 필드\" 를 잡는
    자동 가드가 없다")의 표제줄이다. 인용이 의도한 내용("`3-error-handling.md §1.4` 의
    «앵커 없는 코드» 7종이 실제로는 메시지 접두다")은 현재 **3494행**에 있다(직접 grep
    확인, `git diff` 상 이 항목은 바로 이 배치가 같은 커밋에서 새로 등재한 것이다).
  - 상세: 라운드 8 fix(commit `061f5153f`)는 §1.4 CRITICAL을 닫으며 "분류기 목록이 같은
    이름을 인용해 `MAX_ITERATIONS_EXCEEDED` 류가 통과한다"는 주장의 근거로 트래커 줄
    번호를 인용했는데, 바로 같은 라운드/같은 커밋이 그 트래커 파일 상단에 새 항목
    2개(§1.4 항목 포함)를 **삽입**해 하단 내용이 전부 아래로 밀렸다. 인용 시점에 편집
    후 최종 줄 번호로 재확인하지 않은 것으로 보인다 — 이 plan이 §K("줄 인용이 한 줄
    어긋났다")·§H("orphan JSDoc이 두 라운드에 걸쳐 두 블록 밀렸다")에서 스스로 이름
    붙인 "구조를 바꿨으면 증거를 다시 만들어라" 실패 형태의 재발이다. CRITICAL은
    아니다 — 결정 충돌이 아니라 자기참조 인용의 사후 drift이며, 원 클레임(§1.4 표가
    앵커 없는 코드를 카탈로그 항목으로 인정한다는 사실)은 그대로 참이고 코드 동작에
    영향이 없다.
  - 제안: `guide-identifier-scan.ts:94`의 인용을 `:3494`로 정정한다(코드 파일 수정이므로
    이번 배치의 "완료 기준: 마지막 라운드가 `codebase/**` 수정 0으로 끝날 것"에 걸리는
    것을 감안해 다음 라운드에 함께 반영). plan 자체의 구조·트래커 항목 내용은 정확하므로
    plan 문서 수정은 불필요하고 코드 주석 쪽 한 줄만 고치면 된다.

## 요약

`error-code-emission-axis` plan은 미해결 결정을 일방적으로 내리지 않고 트래커에 양방향
역참조로 위임했고, 직전 라운드(8)가 지적한 stale 실측치도 이번 커밋에서 정확히 갱신됐다
(622/439/156/27 실측 일치 확인). 유일한 새 발견은 그 라운드 8이 CRITICAL을 닫으며 새로
써넣은 트래커 줄 번호 인용이 같은 커밋의 다른 편집으로 인해 어긋난 것이다 — 결정 충돌도
선행조건 미해소도 아니지만, 이 plan이 반복해 자백해 온 "인용 시점과 최종 상태 불일치"
패턴의 또 다른 사례라 다음 라운드에 함께 정정할 것을 권고한다(WARNING). 그 외 spec_impact
목록 완전성(6파일 전수 대조), 카탈로그-탈출구 설계와 미해결 backfill 결정의 독립성,
`user-guide-evidence.md §2` 미등재 상태의 정확한 서술은 모두 확인했고 이상 없다.

## 위험도
LOW
