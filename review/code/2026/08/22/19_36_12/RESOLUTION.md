# RESOLUTION — `19_36_12` (Critical 0 · WARNING 1 · RISK LOW)

직전 라운드(`19_25_39`)가 WARNING 2, 이번이 **1**. 해소된 것과 새로 잡힌 것이 다르다.

## 해소 확인 — 직전 W1 (docblock 언어 혼재)

여러 reviewer 가 **각자 파일을 열어** 재확인했다: 블록 전체가 한국어로 통일됐고 영문
bullet 3개의 정보 손실 없음, `## 헤딩 + 한국어` 스타일이 `shared/utils/` 트리의 기존 관례와
일치. 직전 라운드에서 내가 만든 회귀가 실제로 닫혔다.

## W1 (requirement) — 반영 · **미머지 PR 을 근거로 삼았다**

**지적**: 완료 plan 이 *"신설 `egress-masking.md §3` 이 이미 이 클래스를 소유한다"* 고 적어
**아직 머지되지 않은 PR #1194**(`state: OPEN` 실측)의 존재를 기정사실로 전제했다. 머지 순서가
보장되지 않으므로 #1194 가 늦게 들어오거나 철회되면 *"이번 diff 가 산문 지점을 3곳 늘렸다"*
는 사실이 **어느 문서에도 남지 않는다.**

**정확한 지적이고, 이 저장소가 이미 등재한 교훈의 새 형태다** — *"`review/**` 는 SoT 가
아니다"* 와 같은 축인데, 이번엔 SoT 가 아닌 것이 review 산출물이 아니라 **아직 main 에 없는
문서**였다.

정본 트래커(**in-progress — 계속 편집 가능**)에 폴백 항목을 등재했다:

- 늘어난 산문 지점 3곳을 **구체적으로** 적었다(Swagger description · `REASON_TO_DETAIL` JSDoc ·
  base 함수 JSDoc)
- **#1194 가 머지되면** `egress-masking.md §3` 이 흡수하므로 그때 닫는다
- **#1194 가 철회되거나 늦게 들어오면** 이 항목이 유일한 기록이다 — 그래서 `complete/` 로
  봉인된 plan 이 아니라 여기 적었다

리뷰어 지적대로 `masked-marker-cosmetic-followups.md` 는 이미 `status: complete` 라 손대지
않았다.

## INFO 15건 — 조치 안 함

전부 "조치 불요"/긍정 확인이거나 이미 트래킹 중이다. 기록할 것 셋:

| # | 항목 | 처분 |
| --- | --- | --- |
| 3 | base JSDoc 의 wrapper 이름이 CI 가드를 오탐시키지 않는가 | 리뷰어가 **가드 소스를 직접 읽어** `ts.createSourceFile` + identifier 노드만 순회하므로 JSDoc 트리비아는 판정 대상이 아님을 확인했다 — 내 뮤테이션 2종 결과와 일치 |
| 4 | `REASON_TO_DETAIL` 신규 JSDoc 3건의 단일행/다중행 포맷 불일치 | 안 고친다. `missing_required` 는 한 줄로 충분한 내용이고, 길이에 맞춰 포맷을 고르는 것이 파일 전체에 이미 섞여 있는 관례다 |
| 5 | `resolveTriggerParameters` docblock 이 24줄로 길어짐 | 안 고친다. 그 길이의 대부분이 **wrapper 와의 관계**인데, 그게 이 항목(798)이 존재한 이유다. 리뷰어도 *"또 다른 wrapper 가 추가되면"* 을 분리 조건으로 달았다 |
