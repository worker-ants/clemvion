# RESOLUTION — `16_07_45` (Critical 0 · WARNING 2)

전체 위험도 **LOW**. Critical 0건. WARNING 2건은 **둘 다 같은 원인** — 정본 트래커
(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`) 갱신 커밋 `5d5d4565f` 이
이 PR 의 명시 목표(backend `deepRedactSecrets` 깊이 경계 테스트)와 무관한 grooming 을
싣고 있었다.

## WARNING #1 — 무관한 breaking 결정 기록 (scope)

**지적**: 두 Manual 엔드포인트의 `error.code` 를 `INVALID_TRIGGER_PARAMETERS` 로 통일하는
결정 노트가 이 PR 의 커밋 계열에 들어 있다.

**처분: 반영 (분리)** — 리뷰어가 제시한 두 선택지("분리" 또는 "PR 설명에 명시") 중
**분리**를 택했다. 근거 둘:

1. 이 저장소가 이미 등재한 관행 권고 — *"기능 PR 에서 부산물이 파생되면 별도 PR 로
   분리하는 편이 낫다"* (`04_46_40`·`05_08_35` scope W1, 트래커 L806).
2. **후속 PR 이 같은 파일을 편집한다.** 결정을 집행하는 planner PR 이 이 트래커의 같은
   항목을 `[x]` 로 닫으므로, 두 PR 이 같은 줄을 건드려 머지 충돌이 난다. 분리하면 그
   충돌 자체가 생기지 않는다.

## WARNING #2 — 요청 범위를 넘는 37건 일괄 재판정 (scope)

**지적**: consistency 가 요구한 범위(L192 항목 1건)를 넘어 트래커 미체크 37건 전부를
재판정하는 절을 추가했다.

**처분: 반영 (분리)** — #1 과 같은 커밋이라 같은 조치로 해소된다.

> 재판정 자체는 사용자가 명시 요청한 작업이고 리뷰어도 *"문서화 품질 자체는 높고 잘못된
> 재판정은 발견되지 않음"* 이라 판정했다. 문제는 **내용이 아니라 어느 PR 에 실리는가**다.

## 집행

`git format-patch -1 5d5d4565f` 로 보존한 뒤 `git rebase --onto dfb427dce 5d5d4565f` 로
이 브랜치에서 드롭했다. 실측 확인:

```
git diff --name-only origin/main..HEAD -- plan/in-progress/spec-sync-external-interaction-api-gaps.md
→ 0줄
```

남은 changeset 은 **테스트 1파일 + 완료 plan 2건 이동 + consistency 산출물**뿐이다.
트래커 변경분(재판정 + 결정 노트 + egress-masking 신규 항목)은 **planner PR** 로 옮긴다 —
그 PR 이 `error.code` 통일과 spec 3건을 집행하면서 같은 항목들을 닫는다.

## INFO (조치 안 함 — 사유)

| # | 항목 | 사유 |
| --- | --- | --- |
| requirement #4 | 제목 "한 칸 위(-1)" 의 방향 표현 | `-1` 이 함께 적혀 있어 오독 여지가 낮다는 리뷰어 자신의 판정. 제목은 **상한 기준 한 칸 바깥(= 아직 마스킹되지 않는 쪽)** 을 뜻하며, 그 의미로는 "위" 가 맞다 |
| maintainability #5 | `nestObj`/`nestArr`/`nestMixed` 중복 | 리뷰어 권고대로 **넷째 분기가 생길 때** 추출. 지금 추출하면 세 헬퍼의 차이(래핑 방식)가 파라미터 뒤로 숨어 오히려 읽기 나빠진다 |
| maintainability #6 | `5000` 리터럴 | 리뷰어가 *"매직넘버치고 이례적으로 잘 문서화됨"* 이라 판정했고, **재사용처가 0** 이다. 상수 승격은 재사용이 생길 때 |
| maintainability #7 · testing #8 | 배열 분기 `it` 입자성 · 5000-트리 2회 생성 | 전부 (선택) 표기. 스위트 실행이 0.2s 라 비용 근거가 없다 |
| security #1~3 · testing #9~10 · side_effect #11 · scope #12~13 · documentation #15 | "조치 불필요" 명시 | 확인 사항 |
| documentation #14 | egress 마스킹 conventions 문서 부재 | **planner 권한**. 트래커에 등재했고 그 등재분이 위 분리로 planner PR 에 실린다 |

## 후속 리뷰

changeset 이 줄었으므로(트래커 1파일 제거) 원 리뷰는 stale 이다. 축소된 changeset 으로
`/ai-review` 를 재실행해 Critical·Warning 0 을 확인한다.
