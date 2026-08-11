# Rationale 연속성 검토 — spec/7-channel-web-chat (라운드 3, 델타: R0→R7 재번호 + 2-sdk.md 상호참조 + JSDoc 정정)

## 사전 확인 (재실측)

`git diff origin/main...HEAD --stat -- codebase/channel-web-chat spec/7-channel-web-chat` 로 이번 라운드
diff 범위를 재확인: `use-widget.ts`/`use-widget.test.ts`/`use-widget-eager-start.test.ts`(코드) +
`4-security.md`/`2-sdk.md`(spec) 5개 파일. 커밋 이력(`3f1169ab5`→`d8abc7003`→`99d3e9000`→`cebc421a7`)을
`git show`로 전수 대조했다.

## 점검 1 — 재번호가 내용을 바꿨는가

`git show 99d3e9000 -- spec/7-channel-web-chat/4-security.md` 로 R0 삭제 hunk 와 R7 추가 hunk 를 직접
대조했다. 제목 번호(`### R0.` → `### R7.`)와 문서 내 위치(중간 → Rationale 절 끝, 저장소 관례 — R1~R6
뒤)만 바뀌었고, 본문(기각한 대안 서술, 두 실측 근거, "정당한 비-http(s) 배포는 없다" 판정, self-correcting
blockquote, §R8 상호참조 문장)은 **글자 단위로 동일**하다. 근거 서술의 훼손·누락 없음 — 이 재번호는
순수 관례 정합화(커밋 메시지 자체가 "Rationale 은 예외 없이 R1 부터 시작" 관례 위반을 이유로 든다)이고
내용 번복이 아니다. **문제 없음.**

## 점검 2 — `safeApiBase` JSDoc 자기정정 blockquote 가 §R7 서술과 일관되는가

### 발견사항

- **[WARNING]** JSDoc 자기정정 blockquote 가 재번호 이후에도 존재하지 않는 `§R0` 를 가리킨다(죽은 참조)
  - target 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:197`
    ```
    * > 첫 판은 "`applyConfig` 가 자기 자리에서 실패한다" 고 적었다. **거짓이다.** spec §R0 에서
    * > 그 문장을 정정하면서 **여기(코드 SoT)는 안 고쳤다** — 한 사실을 두 곳에 복제해 놓고 한
    * > 곳만 고친 형태다(ai-review `15_32_44` documentation CRITICAL).
    ```
  - 과거 결정 출처: `spec/7-channel-web-chat/4-security.md ## Rationale ### R7`(재번호 전 `R0`,
    커밋 `99d3e9000` "convention WARNING — `R0` 는 저장소 전역 관례를 어긴 유일 사례였다")
  - 상세: `git show 99d3e9000` 로 확인한 결과, 이 blockquote 와 `R0→R7` 재번호는 **같은 커밋**에서
    함께 들어갔다. 그런데 재번호 diff(`spec/7-channel-web-chat/4-security.md`)는 헤딩을 `R0`→`R7`로
    바꿨지만, 같은 커밋이 새로 쓴 JSDoc blockquote 의 "spec §R0" 문구는 갱신하지 않았다. 현재
    `git grep -n "§R0" -- spec/ codebase/` 결과 저장소 전체에서 **이 한 줄만** `R0` 를 가리키고, spec 쪽엔
    `R0` 헤딩이 더 이상 존재하지 않는다(`4-security.md` 는 `R1`~`R7`만 있음, `git grep "^### R"` 확인).
    즉 이 참조는 오늘 시점 **dangling reference** 다 — 독자가 "spec §R0" 를 따라가면 못 찾는다.
    - **내용 자체는 모순되지 않는다**: blockquote 의 "첫 판은 …고 적었다. 거짓이다" 서술과 §R7 본문의
      "첫 판은 …고 적었는데 거짓이다 — `applyConfig` 는 `warn`도 `dispatch`도 없이 조용히 반환한다…
      선재 갭이며 별도로 등재했다(ai-review `15_16_20` side_effect)" 서술은 **같은 사실을 가리키는
      동일 이야기**다(진단 지점=`safeApiBase`의 `console.warn` 뿐이라는 결론도 일치). 따라서 이건
      "서로 다른 이야기를 하는" 유형의 충돌이 아니라, **위치 포인터(번호)만 죽은** 유형이다.
    - `2-sdk.md`(같은 커밋에서 추가된 cross-ref, `BootConfig.apiBase` 옆 주석)와
      `plan/complete/webchat-boot-apibase-scheme-validation.md:46,93`(같은 항목을 다루는 완료 plan)은
      둘 다 정확히 `§R7`(plan 은 `§R7(당시 §R0)`로 이력까지 명시)을 쓴다 — 즉 **같은 렌트리 안에서
      JSDoc 한 곳만 갱신을 놓쳤다**. 이 PR 이 이미 두 차례(`d8abc7003`의 testing CRITICAL, `99d3e9000`의
      documentation CRITICAL) "정정을 한 곳에만 하고 자매(spec↔JSDoc)를 놓친다" 패턴으로 지적받은
      바로 그 형태의 **경미한 재발**이며, 공교롭게도 이번엔 그 패턴을 설명하는 blockquote 자신이
      재발 지점이다.
  - 제안: JSDoc 의 `spec §R0` → `spec §R7`로 한 글자 수정(`use-widget.ts:197`). 재번호 커밋에
    `git grep -n "R0" -- codebase/` 를 재번호 직후 습관적으로 돌리면 이런 잔여 참조를 잡을 수 있다.

## 점검 3 — 이 PR 이 3라운드를 거치며 결정을 바꾼 적이 있는가

`3f1169ab5`(도입) → `d8abc7003`(리뷰 fix) → `99d3e9000`(리뷰 fix) → `cebc421a7`(리뷰 산출물 커밋, 코드/spec
불변) 순으로 커밋 메시지와 diff 를 전수 대조했다.

- **핵심 결정("두 입력 경로 모두에 스킴 검증을 건다", "비대칭 유지 대안은 기각")은 `3f1169ab5`에서
  확정된 뒤 이후 라운드에서 한 번도 번복되지 않았다.** `d8abc7003`·`99d3e9000` 은 모두 그 결정을
  **집행의 완결성**(호출부 배선 누락, deprecated 별칭의 거짓 정당화, JSDoc 미동기화, 완료-조건 표
  미갱신, vacuous 테스트)을 좁히는 fix 였지 결정 자체를 바꾸지 않았다.
- 결정과 무관한 **사실 서술의 정정**이 하나 있다 — "`apiBase` 가 없으면 `applyConfig` 가 자기 자리에서
  실패한다"(최초 서술, 거짓으로 판명) → "`warn`도 `dispatch`도 없이 조용히 반환한다"(정정). 이는
  §R7 안에 **self-correcting blockquote**(`> 첫 판은 …고 적었는데 거짓이다`)로 명시적으로 흡수돼 있어
  "결정의 무근거 번복"에 해당하지 않는다 — 오히려 이 관점이 요구하는 "번복 시 새 Rationale 동반"의
  모범 사례다.
  - **점검 2 의 잔여 항목**(JSDoc `§R0` dangling)은 바로 이 정정 문장을 코드에도 복제하려던 시도의
    부산물이며, 정정 자체의 타당성과는 무관한 사후 번호 동기화 누락이다.
- `R0`→`R7` 재번호는 **결정이 아니라 저장소 관례(번호 체계) 정합화**이며(점검 1에서 내용 불변 확인),
  Rationale 연속성 관점의 "결정 번복"에 해당하지 않는다.
- 기각된 대안이 이후 라운드에서 되살아난 흔적은 없다(예: "비대칭 유지"·"fail-open 무제한 통과"류 재도입
  없음. `R6`의 "무제한 통과 기각" 원칙과도 무관 — 이번 diff 는 `R6`을 건드리지 않는다).

## 요약

R0→R7 재번호는 내용 손실 없이(글자 단위 동일) 저장소 번호 관례를 정합화한 것으로 확인됐다. `safeApiBase`
JSDoc 의 자기정정 blockquote 는 §R7(4-security.md)과 **서사·결론 모두 일치**하지만, 재번호 이후에도
존재하지 않는 `§R0`를 계속 가리키는 **죽은 참조**로 남아 있다 — 이는 이 PR 이 두 차례 CRITICAL 로 지적받은
"정정을 한 곳에만 하고 자매를 놓친다" 패턴의 경미한 재발이며, 정정 그 자체를 설명하는 문장이 재발
지점이라는 점이 아이러니하다. 다만 내용 자체가 모순되지는 않으므로 CRITICAL 은 아니다. 핵심 기술 결정("두
경로 모두 스킴 검증, 비대칭 유지 기각")은 3라운드 내내 한 번도 번복되지 않았고, 유일한 서술 정정("진단
지점")은 §R7 안에 self-correcting blockquote 로 명시적으로 기록돼 있어 Rationale 연속성 원칙(결정 번복
시 근거 동반)을 준수한다. Critical 급 발견 없음.

## 위험도

LOW

STATUS: OK
