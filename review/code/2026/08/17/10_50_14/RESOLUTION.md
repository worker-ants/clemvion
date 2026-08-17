# RESOLUTION — `10_50_14` ai-review 6라운드 후속 조치

**CRITICAL 0 · WARNING 1 · 위험도 LOW.** forced 7명 전원 결과 확보.
security·requirement 는 **위험도 NONE**.

## WARNING 1 — **반영** (같은 결함 클래스의 세 번째 재발)

`describe` 블록 **제목**이 레벨 분리(`83436ed45`) 이후에도 옛 정책 *"inputData 비대상 고정"*
을 단언했다 — 같은 블록의 `⑤`·`⑥-b` 는 정확히 반대를 고정한다.

제목을 레벨 명시로 정정했다:
`outputData + 노드 레벨 inputData 마스킹 — 표면 전수 (Execution.inputData 는 카브아웃)`

### 인스턴스가 아니라 클래스를 훑었다

이 클래스가 세 번 재발했다 — JSDoc 개수(`00_23_57`) → JSDoc 방향 오분류(`10_26_58`) →
`describe` 제목(`10_50_14`). 매번 인스턴스만 고쳐 다음 것이 나왔으므로, 이번엔
**세 spec 파일 전체를 `비대상` 으로 전수 스캔**해 살아있는 인스턴스가 그 제목 하나뿐임을
확인했다(다른 하나는 *"초판은 …로 오분류했다"* 는 **의도적 이력 서술**이라 보존).

## 같은 사이클의 `--impl-done`(`10_50_17`) — **BLOCK: NO** 🎉

CRITICAL 0. 5개 checker 중 plan_coherence·naming_collision 은 **NONE**.
WARNING 2건은 4~5라운드 이월된 기지 항목이었고, **둘 다 이번에 닫았다**:

- **whack-a-mole 논거 미반박** — `12-webhook.md` Rationale 이 display 시점 마스킹을 기각하며
  든 *"모든 read 경로를 개별 마스킹해야 한다"* 에 §R17 이 답하지 않고 있었다. 타당한 우려이고
  **이 작업이 실증까지 했으므로**(표면 4→6, 카브아웃 범위 1회 되돌림) 회피하지 않고 정면으로
  답했다: 방어가 **호출부 산발 패치가 아니라 소수 공유 관문으로 수렴**해 새 경로가 관문만
  지나면 마스킹을 구조적으로 상속한다 — 늘어나는 것은 *표면의 발견*이지 *손으로 거는 자리*가
  아니다.
- **Swagger DTO description 길이 규약 초과** — (a)안(규약 갱신)을 택했다. 실측상 9곳 이상의
  DTO 가 이미 이 형태이고, **응답 값이 저장 값과 다를 수 있는 필드**는 OpenAPI 만 보는
  소비자에게 그 설명이 유일한 단서라 길이 예외가 정당하다. 다만 "상세는 spec 본문, 여기는
  요약+링크" 라는 경계를 함께 규정했다. **규약이 현실을 반영하도록 고친 것**이지 위반을
  방치한 것이 아니다.

## INFO 22건 — 조치 불요

전부 선행 라운드가 평가·수용·등재를 마친 항목의 재확인이거나 양호 사례 기록이다.
`Execution.inputData` 카브아웃(등재됨) · bare `token=`(등재됨) · WS role 미검사(선존, 이번
PR 은 완화 방향) · 마커 JSDoc 귀속(2라운드 이연 유지, **등급 상향 금지**로 재확인) ·
`maskIfPresent` 방어 분기(기존 처분 유지) 등.

CHANGELOG 의 *"Output 탭"* → *"Input/Output 탭"* 정정(requirement INFO-6)은 반영했다.

## 검증

TEST WORKFLOW 4단계 PASS — lint / unit(백엔드 427 suites) / build / e2e **276**
