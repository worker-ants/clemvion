# RESOLUTION — `--impl-done spec/conventions/` 라운드 4 (`review/consistency/2026/09/13/20_34_48`)

**BLOCK: NO** · Critical 0 · WARNING 5 · INFO 9 · 위험도 LOW.
5개 checker 전원 전문 제출. `[CRITICAL]` 마커 0건.

## WARNING#5 — `staleEntries` 이름 충돌 (고침)

라운드 3 에서 만든 헬퍼가 기존 **export 함수**와 동명이었다:

| | 위치 | 시그니처 |
|---|---|---|
| 기존 | `repo-guards/__tests__/internal-package-registration-guard.ts:129` (export, 8곳 사용) | `(string[], string[]) => string[]` |
| 내 것 | `docs/__tests__/guide-identifier-existence.test.ts` (지역) | `({token}[], ReadonlySet) => string[]` |

`staleGuideEntries` 로 개명. **양쪽을 함께 돌려** 확인했다 — 24파일 3,419건 GREEN, 기존
소유자 8곳 무영향. 내 파일의 `staleEntries` 잔여 0건, 기존 쪽 8건 그대로.

> **이름을 정하기 전에 grep 하지 않았다.** 이 저장소가 적어 둔 규칙 —
> *"새 식별자는 후보 토큰이 grep 0건임을 먼저 보여라"* — 을 어긴 것이고, 같은 클래스가
> 과거에도 한 PR 에서 두 번 났다(`D-*`→`CV-*`). 개명 사유를 JSDoc 에 남겼다.

## WARNING#1~#4 — 전부 planner 등재분 (조치 불요)

| # | 항목 | 상태 |
|---|---|---|
| 1 | spec 6파일의 `CONTAINER_*` 서술 | 4라운드 연속 불변 · 등재분 |
| 2 | §1.4 의 «코드/메시지접두» 축 미명시 | 등재분 (택일 대기) |
| 3 | #1·#2 의 Rationale 계보 관점 | 등재분 |
| 4 | 발행 축 하네스의 SoT 문서 부재 | 선재 구조 공백 · 등재분 |

checker 들이 *"이미 등재, 재등록 불요, 이 PR 비차단"* 으로 공통 판정했다.

## INFO 처분

| # | 항목 | 처분 |
|---|---|---|
| 2 | `GUIDE_NON_EMITTED_VOCABULARY` 가 트래커 문구에 **2번째 번복 사례로 미지목** | **등재 보강** — 아래 |
| 1·3·4·5 | `PROJECT.md` SoT · §2 미등재 · spec 스코프 | 등재분·조치 불요 |
| 6~9 | 인용 형식 준수 · 명명 정합 · spec 경계 준수 · 토큰 재등재 | **양성 확인** |

INFO#2 는 실제로 빠진 것이라 트래커 문구에 반영했다 — 그 항목이 *"허용목록 없음 원칙의
번복"* 을 1번째(`GUIDE_EXTERNAL_VOCABULARY`)만 이름으로 들고 있었다.
