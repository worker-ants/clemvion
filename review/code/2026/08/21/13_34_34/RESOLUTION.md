# RESOLUTION — 13_34_34

대상 SUMMARY: `review/code/2026/08/21/13_34_34/SUMMARY.md` (위험도 **LOW**, Critical **0**, WARNING **1**, INFO 15)

**처분: WARNING 1건 수정.** 리뷰어 스스로 *"기능 영향 없음, 병합을 막을 사유 아님"* 이라
적었지만 고쳤다 — 내용이 하필 **비대칭을 경고하는 문단** 이라서다.

---

## WARNING 1 — **비대칭을 경고하는 문단을 한쪽에만 넣었다** (maintainability) — **수정**

직전 라운드에서 *"판정 분기를 고칠 때는 양쪽에 대칭 캐너리를 함께 넣는다"* 는 규칙을
소스에 옮겼다. 그런데 **frontend spec 에만 넣고 backend spec 에는 안 넣었다.**

> 규칙을 쓰면서 그 규칙을 어겼다. 이 PR 이 다섯 라운드 동안 반복해 겪은 패턴이 문서 층에서
> 한 번 더 나온 것이고, 하필 그 패턴을 경고하는 문장이 대상이었다.

backend spec 에 동일 취지 문단을 추가했다. **이번엔 대칭을 실측으로 확인했다** — 네 파일
(양쪽 가드 + 양쪽 spec) 전부 규칙 문단 1건씩:

```
1  backend  masked-marker-mirror.spec.ts
1  frontend masked-marker-mirror.test.ts
1  backend  masked-marker-mirror-guard.ts
1  frontend masked-marker-mirror-guard.ts
```

"고쳤다" 를 쓰기 전에 세는 것 — 그것이 라운드4 에서 배운 것이고 여기 적용했다.

## 미조치 INFO (15건)

전부 리뷰어 스스로 "조치 불요" 또는 이미 plan 트래커 등재. 대표 —

- **탐지 로직 복제를 공유 패키지로 재추출** (architecture INFO 1) — 이번 PR 이 2회 비대칭
  사고의 근원임을 실증했으니 검토할 가치가 있다는 지적에 동의한다. 다만 test-only 로직을
  위한 새 패키지는 **이 PR 의 범위를 또 한 번 넓히는 일**이고, 방금 그 비대칭에 캐너리를
  걸어 기계가 지키게 만든 직후다. 별건으로 남긴다.
- `SOT_DIR` 정규화 기법 비대칭 · 긴 JSDoc 줄 · backend 깊이 경계(plan 등재) · frontend 경계
  테스트가 리터럴 사용 · `pnpm-lock` 노이즈(6라운드 연속 동일) · CHANGELOG 미기재(선례 일치).

## 수렴 판정

| 라운드 | Critical | Warning | 위험도 | 발견의 성격 |
|---|---|---|---|---|
| `11_27_29` | 0 | 3 | MEDIUM | 가드 배치가 경로 게이팅 갭 재도입 |
| `11_53_49` | 0 | 3 | MEDIUM | 감시 목록이 미러 · 세 번째 스택 무방비 |
| `12_25_15` | 0 | 1 | MEDIUM | 파생이 "전수처럼 보이지만 아닌" 목록 |
| `12_50_37` | 0 | 3 | MEDIUM | 완료형 서술이 거짓(한쪽만 고쳐짐) |
| `13_14_29` | 0 | 3 | LOW | governance · 섀도잉 · 문서 정확성 |
| `13_34_34` | 0 | **1** | **LOW** | **문서 비대칭 한 건** (리뷰어: 기능 영향 없음) |

**추출된 값 자체**(마커 3종·`isMaskedMarker`·`MAX_MASK_DEPTH`)는 여섯 라운드 내내 지적이
없었다 — 모든 발견은 그것을 지키려고 만든 **가드 쪽**이었다. 이제 그 가드도 문서 한 문단만
남았고, 그마저 리뷰어가 비차단으로 판정했다.

## 검증

TEST WORKFLOW 4단계 PASS + ratchet —

| 단계 | 결과 |
| --- | --- |
| lint | PASS (48s) |
| unit | backend jest **431 suites / 8,916 passed**(1 skipped) · frontend **287 files** |
| build | PASS (140s) |
| 타입체크 ratchet | **199건 / 38파일 baseline 일치** |
| e2e | PASS (206s) — backend supertest **276** · playwright **51** |

> 주석만 바뀌었지만 이 저장소는 **영향 추정으로 e2e 를 면제하지 않으므로** 전 단계를 돌렸다.
