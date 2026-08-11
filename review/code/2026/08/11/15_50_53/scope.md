# 변경 범위(Scope) Review — 커밋 `99d3e9000` (재검토, 직전 라운드 `15_32_44` LOW/수렴 판단 재확인)

## 점검 배경

직전 라운드(`15_32_44`)는 CRITICAL 1 + WARNING 2(convention·plan_coherence) + INFO 5 를
냈고, 스스로 **LOW / 머지 가능·수렴**으로 정리했다(`review/code/2026/08/11/15_32_44/SUMMARY.md`).
이번 커밋 `99d3e9000` 은 그 8건을 처분한다고 주장한다(`RESOLUTION.md`). 아래 4가지를
직접 `git show`/`Read`/`Grep` 으로 재검증했다.

## 1. `git show 99d3e9000 --stat` — 처분 항목과 1:1 대응하는가

```
codebase/.../use-widget-eager-start.test.ts      | +32
codebase/.../use-widget.ts                       | +12 -1
plan/complete/webchat-boot-apibase-scheme-validation.md      | +4 -4
plan/in-progress/webchat-auth-session-status-reconcile.md    | +7 -1
spec/7-channel-web-chat/2-sdk.md                 | +1 -1
spec/7-channel-web-chat/4-security.md            | +36 -36
```

**모두 대응됨, 범위 밖 파일 없음.**

- `use-widget.ts` +12/-1: `safeApiBase` JSDoc 에 "진단은 거절 지점에만 있다" 단락 신설
  (documentation CRITICAL 처분) — diff 는 정확히 이 JSDoc 블록만 건드리고 그 외 로직은
  무변경. 실측 확인: `applyConfig` 함수 자체(로직)는 diff 에 없음.
- `use-widget-eager-start.test.ts` +32: `trigger` 를 뺀 e2e 케이스 1건 신설
  (testing INFO — vacuous 테스트 교정). 새 `it()` 하나만 추가, 기존 케이스 무변경.
- `4-security.md` +36/-36: `### R0.` 블록을 그대로 `### R7.` 로 옮김(§3 참조, 내용 바이트
  단위 동일 확인).
- `2-sdk.md` +1/-1: `BootConfig.apiBase` 필드에 런타임 검증 상호참조 주석 1줄 추가
  (cross_spec INFO 처분).
- `plan/complete/webchat-boot-apibase-scheme-validation.md` +4/-4: `§R0`→`§R7` 표기 2곳,
  "448 passed"→"라운드1 시점 448 / 최종 450" 정정, `safeApiBaseFromQuery`→`safeApiBase`/
  `mergeBootConfig` 인용 정정(documentation INFO + requirement INFO 처분).
- `plan/in-progress/webchat-auth-session-status-reconcile.md` +7/-1: 완료조건 표에 누락
  행 추가 + 자기반성 blockquote(WARNING 처분), `#PR`→`d8abc7003`(INFO 처분).

전부 `RESOLUTION.md`/`SUMMARY.md` 가 나열한 CRITICAL 1·WARNING 2·INFO 5(cross_spec·
requirement·plan_coherence·documentation·testing)와 파일·내용 단위로 정확히 대응한다.
요청 밖 리팩터링·포맷팅·임포트 변경·무관 파일 수정은 발견되지 않았다.

## 2. `2-sdk.md` 를 새로 건드렸다 — Gate C 관점 갱신 필요성

- **[WARNING] `spec_impact` 선언이 이번 fix 가 실제로 건드린 spec 파일 전체를 반영하지 않는다**
  - 위치: `plan/complete/webchat-boot-apibase-scheme-validation.md:8-9`(frontmatter
    `spec_impact:` — `spec/7-channel-web-chat/4-security.md` 단 하나만 나열) / 실제 변경:
    `spec/7-channel-web-chat/2-sdk.md:149`(`apiBase` 필드에 "런타임 검증: http(s) 스킴만
    허용... [4-security §1 ... §R7]" 주석 신설)
  - 상세: `.claude/docs/plan-lifecycle.md` §Gate C 의 자동 가드(`spec-plan-completion.test.ts`
    → `hasValidSpecImpact`)는 **리스트가 비어있지 않고 각 원소가 실존 spec 파일인지만** 검사한다
    — "이 PR 이 실제로 건드린 spec 파일과 목록이 일치하는가"는 검사하지 않는다. 따라서 이
    누락은 **빌드를 깨지 않는다**. 다만 Gate C 의 명시된 취지("본 작업이 건드린 spec 파일들")
    관점에서는 이 커밋이 `2-sdk.md` 를 실제로(오타 아닌 내용) 편집했는데도 `spec_impact`
    목록에서 빠져 있어, plan 자신의 SoT 선언이 실제 범위보다 좁다. 이 저장소가 반복 지적받은
    "SoT 가 실제보다 한 칸 좁다" 형태(`feedback_defense_defined_one_notch_narrow` 계열)와 같은
    모양이다.
  - 제안: `spec_impact` 에 `spec/7-channel-web-chat/2-sdk.md` 행을 추가한다(1줄, 저비용).
    빌드 gate 는 이미 통과하므로 blocking 은 아니지만, plan 완료 기록의 정확성을 위해 다음
    편집 시 반영을 권한다.

## 3. `R0` → `R7` 재번호가 spec 문서를 크게 흔들었는가

**아니다 — 순수 이동, 내용 불변.** `git show 99d3e9000^:.../4-security.md` 와
`git show 99d3e9000:.../4-security.md` 에서 각각 `R0`/`R7` 블록을 추출해 `R0`→`R7`
치환 후 바이트 단위로 비교했다: **완전 일치**. `### R1.` 앞에 있던 36줄짜리 블록이
문서 끝(`### R6.` 뒤)으로 그대로 옮겨졌고 헤딩 숫자만 바뀌었다. diff 크기(72줄, 즉
36삭제+36추가)는 실질 변경량(1개 섹션 이동 + 숫자 1자리)에 정확히 비례하며 과도하지 않다.

다만 이 이동이 **부수적으로 새 불일치를 하나 만들었다**:

- **[INFO] `use-widget.ts` JSDoc 이 이번 커밋에서 이미 폐기된 `§R0` 를 인용한다**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:197`
    (`> 첫 판은 "applyConfig 가 자기 자리에서 실패한다" 고 적었다. **거짓이다.** spec §R0 에서`)
  - 상세: 이 문장은 이번 커밋(documentation CRITICAL 처분)에서 **신규로 추가**됐다. 그런데
    같은 커밋이 `4-security.md` 의 `§R0` 를 `§R7` 로 재번호(convention WARNING 처분)했다 —
    두 처분이 서로를 참조 확인하지 않고 각자 처리된 결과, 신설 문장이 커밋 직후부터 이미
    stale 한 섹션 번호를 가리킨다. 대조군: 같은 사실을 서술하는
    `plan/complete/webchat-boot-apibase-scheme-validation.md:93` 는
    `"§R7(당시 §R0)"` 로 재번호를 반영해 정확한데, `use-widget.ts` 만 이 처리를 놓쳤다.
    grep 확인(`§R0` 잔존 검색) 결과 코드베이스 전체에서 이 1곳뿐이다. 기능·보안에 영향은
    없고 순수 문서 참조 drift이나, 이 PR 자신이 "정정을 한 곳에만 했다"를 주제로 삼은
    라운드에서 그 형태가 자기 자신의 새 diff 안에 다시 나타났다는 점이 아이러니하다.
  - 제안: `spec §R0` → `spec §R7`(또는 plan 과 같은 `§R7(당시 §R0)` 표기)로 정정. 1단어 수준.

## 4. PR 전체가 원래 plan 범위(`wc:boot` apiBase 스킴 검증 판정)를 지키는가

지킨다. 5라운드(구현 → `15_16_20` 리뷰 → `d8abc7003` fix → `15_32_44`/`15_32_46` 리뷰 →
`99d3e9000` fix)를 거치며 새로 추가된 것은 전부 **이 PR 자신의 산출물(코드·테스트·spec·
plan)에 대한 리뷰 발견사항 처분**이지, plan 체크리스트 밖의 새 기능·새 표면이 아니다:

- 코드 변경은 시종 `safeApiBase`/`mergeBootConfig`/`bridge.onBoot` 배선 하나로 수렴돼 있다.
- 이번 커밋이 건드린 6개 파일 모두 직전 라운드가 만든 산출물(코드 JSDoc·신규 테스트·완료
  plan·연관 in-progress plan·spec 2개 파일)이고, 새 `codebase/` 소스 파일·새 의존성·새
  설정 변경은 0건이다.
- `spec/` 변경(§R7 신설·이동, `2-sdk.md` 상호참조 1줄)은 전부 **이미 구현된 동작을 서술과
  동기화**하는 것이고, 새 정책·새 요구사항을 도입하지 않는다.
- role 경계(`developer` 가 `spec/` 직접 편집) 문제는 직전 라운드에서 저장소 선례(`cbc0d33760`·
  `da078a63f4`)로 HIGH→LOW 하향된 채 남아 있고, 이번 커밋도 같은 궤도(plan frontmatter
  `owner: developer + planner` 로 이미 선언된 범위) 안에서 spec 을 계속 고쳤을 뿐 — 새로운
  거버넌스 우회는 없다.

## 요약

커밋 `99d3e9000` 은 직전 라운드가 낸 CRITICAL 1 + WARNING 2 + INFO 5 전부를 대상 파일·
내용 단위로 정확히 처분했고, 요청 밖 리팩터링·포맷팅·무관 파일 수정은 없다. `R0`→`R7`
재번호는 diff 크기(72줄) 대비 실질 변경(섹션 이동 1건)이 정확히 비례하는 순수 기계적
이동으로, 바이트 단위 비교로 내용 무변경을 확인했다. 다만 두 가지를 새로 확인했다:
(1) 이번 fix 가 `2-sdk.md` 도 실제로 편집했는데 plan `spec_impact` 는 여전히
`4-security.md` 하나만 선언한다 — 자동 Gate C 는 통과하지만(리스트 비어있지 않고 실존
파일이면 충족) 선언 범위가 실제보다 좁다(WARNING). (2) `documentation CRITICAL` 처분으로
새로 추가된 JSDoc 문장이 같은 커밋에서 폐기된 `§R0` 번호를 인용해, 병합 직후부터 이미
stale 하다 — 같은 파일의 자매 서술(plan)은 재번호를 반영했는데 코드 쪽만 놓쳤다(INFO,
기능 영향 없음). 이 둘을 빼면 PR 은 원래 plan 범위(`wc:boot` apiBase 스킴 검증 판정)를
5라운드 내내 벗어나지 않았고, 이번 라운드에서도 새로운 범위 확장·기능 추가·무관 수정은
없다.

**머지 가능 여부**: 코드·테스트·기능 측면은 머지 가능하다. 이번 라운드에서 발견한 2건
(Gate C `spec_impact` 누락 WARNING, `§R0` stale 참조 INFO)은 둘 다 1줄 수준의 문서 정정이라
머지를 막을 정도는 아니지만, 이 PR 이 반복해 겪은 "정정을 한 곳에만 했다" 패턴이 이번
fix 자신의 diff 안에서 다시 나타난 것이므로 같은 턴에 정정하는 편을 권한다.

**수렴 여부**: 기능·구현 범위는 이미 여러 라운드 전에 수렴했고 이번 fix 도 그 판단을
바꾸지 않는다. 다만 문서 정합성 축(spec 상호참조·plan SoT 선언)은 이번 fix 가 기존
불일치 3건을 닫으면서 아주 작은 새 불일치 1건(§R0)을 만들어, "완전히 수렴"이라기보다는
**거의 수렴 — 잔여 1줄 정정 권고**로 정정한다.

## 위험도

LOW — 직전 라운드 판단(LOW/머지 가능·수렴)을 뒤집을 만한 새 CRITICAL/구조적 문제는
없다. 새로 발견한 2건은 WARNING 1(Gate C 선언 범위 누락, 빌드 비차단)·INFO 1(stale
spec 섹션 참조, 기능 무관)로 등급 상향 사유가 아니다.

STATUS: OK
