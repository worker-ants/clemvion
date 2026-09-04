# RESOLUTION — `19_14_29` (수렴 라운드)

## 조치 항목

| SUMMARY # | 발견 | 조치 |
|---|---|---|
| W1 (api_contract/side_effect) | 저장소 밖 제3자 클라이언트의 200→400 breaking change | **코드 변경 없음.** 리뷰어 본인이 *"코드 변경 불필요(설계 근거 타당, 이미 두 차례 리뷰에서 병합 가능 판정)"* 로 판정했다. 문서 쪽 잔여만 아래 INFO#13 으로 처리 |
| INFO#13 | CHANGELOG 가 저장소의 **breaking 태깅 관례**를 안 따라 `grep -i breaking` 에 안 걸린다 | 관례 실재를 확인(`CHANGELOG.md:182,595,625` 에 `(breaking)` 선례)하고 헤더를 `**Behavior change (breaking)**` 로 태깅 |
| INFO#11 | CHANGELOG 만 보면 이 동작에 회귀 테스트가 생겼는지 알 수 없다 | "회귀 고정" 한 줄 추가 |

**둘 다 `CHANGELOG.md` 단독 수정이라 코드는 고정된 채다** — 이 라운드의 판정을 무효화하지
않는다.

## W1 을 코드로 고치지 않는 이유

이 저장소에는 **API 버전 관리·deprecation 체계가 없다**(`2-api-convention.md` grep 0건).
유예 절차를 만들려면 규약 신설이 선행이고, 그것은 **죽은 파라미터 하나보다 큰 작업**이다.
리뷰어도 *"이 저장소 자체가 API 버전 관리 체계를 갖고 있지 않아 이 diff 만의 신규 갭은
아니다"* 라고 명시했다.

완화는 이미 세 겹이다 — (a) CHANGELOG 의 breaking 태깅 + **배포 시 확인** 경고,
(b) 저장소 안 소비자 부재 실측(서비스·FE·spec·e2e·코드젠), (c) 동작을 고정하는 회귀 테스트.

## 남기는 것 (INFO, 비차단)

- **`?workflowId=<uuid>` → 400 을 종단으로 찌르는 e2e 는 없다**(INFO#2). 파이프 유닛
  테스트가 전역 파이프를 겨눠 더 넓게 덮지만 라우트 종단 보증은 아니다. 리뷰어 분류도
  "필수 아님".
- 서사가 네 곳(CHANGELOG·plan·DTO JSDoc·spec JSDoc)에 중복(INFO#7). 두 라운드 연속 INFO
  이고 정량 수치는 세 곳 대조로 일치함이 확인됐다. **다섯 번째 자리가 생기면** 한쪽을 SoT
  로 지정한다.

## TEST 결과

- lint: **PASS**
- unit: **PASS** — backend jest 445스위트 **9,324건**
- build: **PASS**
- e2e: **PASS** — 292건
