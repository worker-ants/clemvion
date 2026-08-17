# RESOLUTION — `00_47_01` ai-review 4라운드 후속 조치

**CRITICAL 0 · WARNING 1 · 위험도 LOW.** forced 7명 전원 결과 확보(`forced_missing` 공집합),
`unfinished` 공집합.

## WARNING 1 — **트래커 등재 (의도적 이연)**

`sanitize-error-message.ts` 의 마커 계층 설명 대형 JSDoc 이 중간에 낀 한 줄 주석들 때문에
`MASKED_MARKERS` 상수에 귀속되지 않는다(주석 **배치** 문제, 내용·동작 무관).

**이 라운드에서 고치지 않는다** — 이 저장소의 수렴 규율에 따른 결정이다:

- 발견의 성격이 **동작(1R WARNING 8) → 구조·CRITICAL(2R) → 문서(3R) → 문서(4R)** 로 이미
  두 라운드 연속 문서 층이다. 이 저장소는 수렴을 *"발견 0"* 이 아니라 **발견의 성격**으로
  판정한다.
- 3R 의 유일한 WARNING 도 주석 한 줄이었고, 그것을 고치자 **4R 이 열려 같은 급의 주석
  nit 을 냈다.** 여기서 또 코드를 만지면 5R 이 열린다 — 리뷰 세션 타임스탬프 vs 코드 커밋
  author date 비교라, **주석 한 글자도 리뷰를 stale 하게 만든다.**
- 기능 위험 0, 동작 변경 0, 계약 변경 0. typedoc 미도입이라 실사용 영향도 없다
  (3R 이 같은 지점을 INFO 로 처분한 근거이며, 4R 이 등급만 올렸다).

`spec-sync-external-interaction-api-gaps.md` 에 등재했다. **`review/**` 는 SoT 가 아니므로
이연 항목은 그 턴에 트래커에 적는다** 는 규율을 지킨 것이다.

## INFO 21건 — 조치 불요

전부 **선행 라운드가 이미 평가·수용·등재를 마친 알려진 트레이드오프**이며, 이번 라운드
재검증에서도 상태 변화가 없음을 리뷰어들이 명시했다. 대표적으로:

- `preserveKeys` 깊이 무관 매칭 · `kb:`/`background:run:` 채널 미마스킹 ·
  `inputData` 의도적 제외 · bare `token=` 미포착 — 전부 트래커 등재 완료
- 양호 사례로 기록된 것들: spec↔코드↔테스트↔DTO 4층 정합, `toResponseExecution` 표를
  단일 정본으로 둔 구조(*"자매 넷 중 하나만"* 결함 클래스의 구조적 제거),
  마커 상수 공유, 뮤테이션 검증 기록
- testing 리뷰어는 **위험도 NONE** 을 냈다

## 같은 사이클의 `--impl-done`(`00_47_04`) — 별도 해소

**CRITICAL: `spec/1-data-model.md` §2.13 이 이 PR 로 거짓이 된 두 문장을 단언**하고 있었다 —
*"4곳"* 이라는 표면 개수와 *"WS `execution.node.*` emit 은 미포함"*. **내 변경이 만든
spec-spec 모순**이라 범위 밖으로 미루지 않고 정정했다: 개수를 지우고 §R17 정본 표를
가리키게 했으며, emit 경로가 이제 마스킹 대상임을 명시했다.

- **WARNING 1**: `13-replay-rerun.md` §10.2 에 `inputData` 비-마스킹 캐비엇 추가.
  **그 모달이 바로 이 결정의 이유**라 침묵이 가장 위험한 자리였다 — 프리필+토글 OFF 기본값
  때문에 마스킹하면 `'***'` 가 실제 입력이 된다는 근거를 그 자리에 적었다.
- **WARNING 2**: plan frontmatter `spec_impact` 가 실제 변경 spec 의 부분집합이었다.
  **실측으로 7개 전부** 채웠다(`git diff --name-only origin/main -- spec/`).
  두 plan 문서(in-progress·complete) 양쪽을 동기화했다.
- INFO 8건은 비차단 — 후속 항목으로 남긴다.

## 검증

Gate C(`spec-plan-completion`) + plan 링크 가드 재실행 PASS.
이번 사이클의 코드 델타는 JSDoc 텍스트 1건뿐이고 그 이후 편집은 전부 spec/plan 문서다.
