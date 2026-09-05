# RESOLUTION — `review/consistency/2026/09/05/10_49_27` (`--impl-done`)

**BLOCK: NO** · Critical **0** · WARNING **0** · INFO **10**. 실행 가능한 INFO **3건 전부 조치.**

## 조치 항목

| # | Checker | 지적 | 조치 |
|---|---|---|---|
| INFO#1 | cross_spec + plan_coherence (일치) | 완료된 draft 의 `spec_impact` 가 실제 diff 를 다 나열하지 않음 | **전수로 맞췄다** — 아래 |
| INFO#2 | plan_coherence | 후속 항목이 `review-citations.md` 의 "소급 정리 안 함" 을 **§3** 이라 인용하는데 실제는 **§4** | 정정 |
| INFO#3 | convention_compliance | Rationale 이 *"각주로 등재했다"* 라 하는데 실제 형태는 §2.1 필드 정의 표 안 인라인 문장 | *"필드 정의 설명 안에 함께 등재했다"* 로 정정 |

### INFO#1 — checker 가 든 것보다 **하나 더** 빠져 있었다

두 checker 가 `spec/conventions/spec-impl-evidence.md` 누락을 지적했다. 그대로 한 줄만 넣지
않고 실제 diff 를 전수로 확인했다:

```
git diff --name-only origin/main -- spec/
  spec/conventions/migrations.md          ← 있었음
  spec/conventions/review-citations.md    ← 있었음
  spec/conventions/spec-impl-evidence.md  ← checker 가 지적
  spec/data-flow/8-notifications.md       ← **아무도 지적 안 함**
```

`8-notifications.md` 는 이 세션의 `10_04_12` W2 로 추가된 파일인데 `spec_impact` 갱신이
빠져 있었다. **지적받은 것만 넣었으면 절반만 고쳤을 것이다.**

## 나머지 INFO 처분

| # | 처분 |
|---|---|
| 4 | `"bare"` 가 기존 3개 문서에서 다른 의미로 쓰인다 — 정의된 식별자 충돌 아니고 문맥상 혼동 사례 없음. 조치 불요 |
| 5~10 | 전부 **정합 확인** (절 번호 정정 일치 · cross-spec 각주 내용 일치 · SoT drift 없음 · `id` 전역 유일 · 결정 번복 없음 · 미해결 결정 경계 준수). 확인 기록 |

## 수렴

이 PR 의 라운드 추이 — 발견의 성격이 단조롭게 내려왔다:

| 라운드 | 성격 |
|---|---|
| `--spec 09_13_39` | 규약 내용·근거 짝짓기 |
| `--impl-done 09_53_09` | 두 규약의 **잠재 충돌**, 스코프 누락 |
| 코드리뷰 `09_42_13`·`10_20_57` | 부록 전문 드리프트, **주장이 실제보다 좁음** |
| `--impl-done 10_04_12` | 상호 링크 |
| 코드리뷰 `10_30_38`·`10_39_00` | 참조 표기, **재지 않고 쓴 수치** |
| `--impl-done 10_13_38`·**`10_49_27`** | **WARNING 0** |

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint · build | **해당 없음** — 애플리케이션 코드 변경 0 |
| unit | **PASS** — frontend 스위트 **289 files / 6,328 tests** |
| e2e | **면제 (화이트리스트 부분집합)** — 변경 set 은 `.md` 와 `review/**` 아래 `.json` 뿐 |

## 보류·후속 항목

없음. 이 PR 이 등재한 3건(`mixed=true` 도입 · bare 인용 8건 · `V110` 헤더 서술)은
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 있다.
