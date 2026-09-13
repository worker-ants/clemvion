# RESOLUTION — `--impl-done` 라운드 2 (`review/consistency/2026/09/13/15_03_36`)

**BLOCK: YES · CRITICAL 1 · WARNING 1 · INFO 3.** CRITICAL 해소 완료.

## CRITICAL — 내가 아는 규약을, 같은 커밋 안에서, 한 번은 지키고 한 번은 어겼다

`convention_compliance` 가 잡았다: `review-citations.md §2` 는 **bare `hh_mm_ss`** 인용을
명시 금지하는데, 새 주석에 `` `14_41_14` `` 를 그대로 적었다.

**같은 diff 의 다른 파일은 같은 세션을 규약대로 인용하고 있었다**:

| 파일 | 인용 |
|---|---|
| `guide-identifier-scan.ts:73` | `` `review/code/2026/09/13/14_41_14` `` ✓ |
| `guide-identifier-existence.test.ts:98` | `` `14_41_14` `` ✗ |

즉 규약을 몰라서가 아니라 **한 자리에서 지키고 두 파일 건너에서 놓쳤다**. 이 저장소가
반복해 지적해 온 형태이고, 이 세션에서도 이미 같은 클래스를 겪었다(`#1328` 에서 bare
인용 8건).

### 처분

전체 경로로 교체하고, **클래스 전수 재검사**를 함께 돌렸다 — 이 배치가 만진 `guide-*` 파일
전부와 `PROJECT.md` 에서 `` `\d{2}_\d{2}_\d{2}` `` 를 다시 세어 **잔여 0건**을 확인했다.
한 자리만 고치고 클래스를 안 보는 것이 그다음 재발 경로다.

## WARNING

| # | 처분 |
|---|---|
| 1 | **등재분** — *"허용목록 없음"* 번복 근거가 spec `## Rationale` 로 미승격. `spec/**` 이라 권한 밖이고 planner 항목에 초안까지 실어 뒀다. checker 도 *"developer 가 절차대로 위임한 상태"* 로 확인 |

## INFO — 조치 불요

- **1 (3-checker 수렴)**: `user-guide-evidence.md §2` SoT 미등재 — 선재, 등재분(통산 6번째 확인).
- **2**: `cafe24-api-metadata.md §4` Principle 오인용 — 선재·무관, 등재분.
- **3**: 이번 허용목록이 `#1330` 이 기각한 것과 **다른 대안**이라는 확인 — *"frontend 자기증명
  오염"* 축은 그대로 보존했다(기준집합에 frontend 소스 미포함). **완전한 원칙 폐기가 아니라
  부분 번복**이라는 checker 의 정리가 정확하다. planner 가 Rationale 을 쓸 때 *"무엇을
  뒤집고 무엇을 보존했는지"* 를 한 문장으로 넣도록 등재 문구에 이미 반영돼 있다.

## 검증

정정 후 bare 인용 전수 0건 · 가드 스위트 24/24 GREEN · `run-test-all.sh` 재실행(아래 커밋).
