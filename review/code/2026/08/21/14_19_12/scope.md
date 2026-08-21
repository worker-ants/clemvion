# 변경 범위(Scope) 검토 — masked-marker-contract-7d2e14 (라운드 8, 14_19_12)

## 검토 방법

target 은 "backend/frontend 에 손으로 복제된 마스킹 마커 상수·판정 로직·깊이 상한을
`@workflow/masked-markers` 공유 패키지로 추출한다"는 단일 목표를 가진 PR이다
(근거: `plan/in-progress/masked-marker-shared-package.md`). `git log --oneline origin/main..HEAD`
로 확인한 결과 이번이 최초 추출 커밋(`7cc64fa35`) + 7회 fix→review 사이클(라운드1~7,
`bf0618a7d`~`523f649d8`) 뒤의 **8번째(최종)** 코드 리뷰다.

`git diff --stat origin/main...HEAD` 로 137개 변경 파일을 확인했고, 직전 라운드
(`review/code/2026/08/21/13_55_59/scope.md`, 123개 파일 대상, 위험도 **LOW**)가 이미 실질
변경분(파일 24개, review 산출물 제외)을 전수 분류해 둔 것을 baseline 으로 삼아, **라운드7
scope 검토 이후 무엇이 새로 추가됐는지**만 diff 로 확실히 구분했다 —

```
git show --stat 523f649d8   # 라운드7 처분 커밋
```

결과: 실질 코드 변경은 `masked-marker-mirror.spec.ts` 6줄(문장 중간 앵커로 깨진 blockquote 복원)
과 `plan/in-progress/masked-marker-shared-package.md` 12줄(후속 백로그 등재) 뿐이고, 나머지
14개 신규 파일은 전부 `review/code/2026/08/21/13_55_59/*`(라운드7 자신의 리뷰 산출물)다. 즉
라운드7 scope 검토(123개 파일, LOW) 이후 **스코프 판단에 영향을 줄 만한 신규 표면은 없다.**

## 발견사항

- **[INFO]** `spec/5-system/14-external-interaction-api.md` R17 정정이 developer/RESOLUTION
  턴에서 직접 이뤄진 것 — 4라운드 연속 재확인된 기존 처분, 신규 지적 아님
  - 위치: `spec/5-system/14-external-interaction-api.md:1625`("마커 집합과 깊이 상한의 SoT 는
    **공유 패키지 `@workflow/masked-markers`** 다")
  - 상세: CLAUDE.md 는 "`developer` 는 `spec/` read-only, 구현 중 spec 변경 필요 시 `project-planner`
    위임"을 명시한다. 이 R17 정정은 `bf0618a7d`(라운드1)에서 developer 워크플로 안에서 직접
    커밋됐고, 별도 planner 턴을 거치지 않았다. 이 사실은 은폐되지 않았다 — `11_27_29/RESOLUTION.md`
    WARNING 3 이 자인했고, 이후 `12_50_37/RESOLUTION.md` WARNING 2, `13_14_29/RESOLUTION.md`
    WARNING 1, `13_55_59/scope.md` 가 **매번 동일하게** "내용은 구현과 정확히 일치, SPEC-DRIFT
    아님, 되돌릴 필요 없음, CLAUDE.md 예외 조항화는 이 PR 과 무관한 별도 governance 결정"으로
    처분했다. 이번 라운드에서 코드·spec 어느 쪽도 이 부분이 추가로 바뀌지 않았다(라운드7 이후
    diff 는 위 6줄+12줄뿐).
  - 제안: 새로 조치할 것 없음. 4라운드 연속 동일 처분이므로 이번에도 재론하지 않되, SUMMARY
    가 이 항목을 "새로 발견된 WARNING"으로 오분류하지 않도록 이력만 남긴다.

- **[INFO]** `pnpm-lock.yaml` 의 `eslint-config-next` peer-dependency 재해석 노이즈 — 8라운드
  연속 동일 판정
  - 위치: `pnpm-lock.yaml` (게이트 없음, 프롬프트에 diff 미실림)
  - 상세: 신규 workspace 패키지 등록에 필요한 부분과 별개로 `eslint-config-next@16.3.0` 의
    peer variant 가 하나로 합쳐지며 하위 스냅샷 키가 연쇄 재작성된다. 버전 자체는 불변이라
    `pnpm install` 의 정상 부산물이고, 라운드1(`11_27_29`)부터 라운드7(`13_55_59`)까지 매
    라운드가 동일하게 "무관·조치 불요"로 판정했다. 이번 라운드에서도 이 hunk 자체는 변경되지
    않았다(round7 fix 커밋이 `pnpm-lock.yaml` 을 건드리지 않음).
  - 제안: 조치 불요.

- **[INFO]** consistency 산출물(`10_58_25/rationale_continuity.md`)의 sub-agent 잔여 텍스트 —
  target 코드와 무관, 8라운드 동안 미정리 상태 유지
  - 위치: `review/consistency/2026/08/21/10_58_25/rationale_continuity.md:1`, `:3`
  - 상세: 라운드1 scope 검토가 이미 지적했고 이후 변경되지 않았다. 생성 아티팩트에 국한된
    흠이라 스코프 판정에 영향 없음.
  - 제안: 조치 불요.

## 스코프 내로 확인한 항목 (참고 — 문제 없음)

- **라운드7 이후 유일한 실질 코드 변경**(`masked-marker-mirror.spec.ts` 6줄)은 라운드6 이
  만든 blockquote 파손(문장 중간 앵커 편집 잔존물)을 frontend 쌍둥이와 같은 구조로 되돌리는
  포맷 전용 수정이다 — 판정 로직·테스트 케이스·assertion 은 무변경.
- **`plan/in-progress/masked-marker-shared-package.md` 의 신규 12줄**은 "탐지 로직 자체의
  backend/frontend 중복을 공유 패키지로 재추출"하자는, 이번 PR 리뷰 과정에서 반복 제기된
  제안을 **이 PR 범위 밖 후속 작업으로 명시적으로 분리 등재**한 것이다. 지금 당장 그 재추출을
  구현하지 않고 트래커에 적어 두는 이 절제 자체가 스코프 규율을 지키는 행동이다(직전 라운드
  WARNING 2 "동의한 부채가 또 `review/**` 에만 있었다"의 수정).
- **핵심 소스 변경**(backend `sanitize-error-message.ts`/frontend `masked-markers.ts`의
  재export 전환, `@workflow/masked-markers` 패키지 신설, 등록 표면 8곳)과 **미러 소멸
  가드**(`masked-marker-mirror-guard.ts` 등, backend+frontend)는 최초 커밋(`7cc64fa35`)부터
  포함된 설계 요소이며 7라운드 내내 "추출된 값 자체"에는 지적이 없었다 — 이번 라운드도 다르지
  않다.
- **`review/code/**`·`review/consistency/**` 산출물 다수**는 이 저장소가 committed 아티팩트로
  남기는 표준 워크플로(CLAUDE.md "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무")의
  부산물이며 "무관한 파일 수정"이 아니라 이 changeset 의 리뷰 이력 그 자체다.

## 요약

라운드7 scope 검토(123개 파일, LOW)가 이미 실질 변경 24개 파일을 전수 분류해 "마스킹 마커
계약을 공유 패키지로 추출한다"는 단일 목표에 타이트하게 수렴함을 확인했고, 이번 라운드(137개
파일)에서 그 이후 추가된 것은 `masked-marker-mirror.spec.ts` 의 6줄 포맷 수정과
`plan/in-progress/masked-marker-shared-package.md` 의 12줄 후속-백로그 등재, 그리고 라운드7
자신의 review 산출물 14개뿐이다 — 전부 이미 확인된 스코프 안에 있고 새로운 이탈 표면은 없다.
유일하게 서술할 가치가 있는 항목(`spec/` 직접 편집)은 4라운드 연속 동일하게 "기존에 검토·수용된
위험, 신규 발견 아님"으로 처분됐으므로 이번에도 WARNING 으로 재상정하지 않고 이력 확인
목적의 INFO 로만 남긴다. 나머지 두 INFO(`pnpm-lock` 노이즈, consistency 산출물 잔여 텍스트)도
8라운드 동안 무해함이 반복 확인된 항목이다.

## 위험도
LOW
