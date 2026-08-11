# ai-review SUMMARY — `15_32_44` (forced 7)

델타 = 커밋 `d8abc7003`(라운드 1 CRITICAL 2건 + INFO 처분).

## 집계 — 7/7 착지

| reviewer | Critical | Warning | 위험도 |
|---|---|---|---|
| security | 0 | 0 | **NONE** |
| side_effect | 0 | 0 | **NONE** |
| testing | 0 | 0 | **NONE** (INFO 1) |
| maintainability | 0 | 0 | **NONE** |
| requirement | 0 | 0 | **NONE** (INFO 1) |
| scope | 0 | 0 | LOW (직전 HIGH → 하향) |
| documentation | **1** | 1 | HIGH |

## 직전 CRITICAL 2건이 닫혔다 — 제기자들이 실측으로 확인

- **testing**: 자신이 "204/204 전부 초록" 이라 실측했던 뮤턴트(호출부만 옛 코드)를 다시 심어
  **이제 정확히 1건 RED** 확인. 신규 2건이 vacuous 하지 않음도 확인했고, 나아가
  **"boot 을 통째로 막는" 뮤턴트로 두 번째 케이스의 필요성을 입증**했다(첫 번째만으로는 통과).
  덤으로 `mergeBootConfig` 인자 순서 스왑까지 잡힘을 확인.
- **scope**: `git show` 로 저장소 선례를 찾아 **HIGH → LOW 하향**. `owner: developer` plan 이
  같은 커밋에서 `spec/` 을 고친 패턴이 `cbc0d33760`·`da078a63f4` 등으로 이미 반복 머지돼
  있었다. 그리고 **자기 직전 리포트의 사실 오류를 스스로 정정**했다("`spec_impact` 가 애초에
  선언돼 있었다" → 원본엔 없었고 이 PR 이 Gate C 때문에 추가한 것).

## documentation CRITICAL — 정정을 한 곳에만 했다

spec §R0 의 거짓 문장은 고쳤는데 **그 spec 이 "코드 SoT" 로 지목한 `safeApiBase` JSDoc 에
같은 문장을 그대로 뒀다.** plan 은 "양쪽에 남겼다" 고 주장했다. → **고침.**

## Warning — 전부 고침

| # | 출처 | 내용 |
|---|---|---|
| W1 | documentation · plan_coherence(consistency) **2명 수렴** | 새 절을 추가하며 그 문서의 "완료 조건" 표를 안 고쳤다 — **그 문서가 스스로 경고한 형태** |
| W2 | convention_compliance(consistency) | `R0` 이 저장소 전역 관례(R1 시작·끝에 append)를 어긴 **유일 사례** → `R7` 로 재번호 |

## consistency `15_32_46` — BLOCK: NO (Critical 0)

| checker | 위험도 |
|---|---|
| naming_collision · rationale_continuity | **NONE** |
| cross_spec · plan_coherence · convention_compliance | LOW |

- **rationale_continuity**: `git log -S` 로 **비대칭 결정의 원 커밋(`aba46cc90`, 2026-06-28)을
  찾아** §R0 의 "기각한 대안" 서술이 실제 이력과 **문구까지 일치**함을 확인 — 지어낸 근거 아님.
- **naming_collision**: R0 삽입이 기존 R1~R6 앵커를 깨지 않음을 타 문서 4곳 역참조로 확인.

## INFO 처분

| 출처 | 내용 | 처분 |
|---|---|---|
| testing | "유효 쿼리 + 악성 boot" e2e 부재 — 단위만 커버 | **고침**(아래) |
| cross_spec | `2-sdk.md` 가 런타임 제약을 언급 안 함 | 상호참조 추가 |
| requirement | plan "448 passed" stale | 정정 |
| plan_coherence | `#PR` 자리표시자 | 커밋 해시로 치환 |
| documentation | 완료 plan §관련 이 삭제된 함수명 인용 | 정정 |
| convention | `code:` 에 `use-widget.ts` 미등재(선재) | 무조치 — 이번 PR 이 만든 것 아님 |

### testing INFO 처분 중 **내 새 테스트가 vacuous 했다**

`?apiBase=…&trigger=t1` 로 쓴 e2e 가 폴백 제거 뮤턴트에 **그대로 통과**했다 — 같은 파일의
"host 없이 직접 로드" 경로가 boot 과 무관하게 쿼리만으로 부팅해 버려 두 경로가 같은 결과를
낸다. 쿼리에서 `trigger` 를 빼 `mergeBootConfig` 폴백이 유일 공급원이 되게 고쳤고, 같은
뮤턴트가 이제 **3건 → 4건 RED**.

## RISK: LOW
## CRITICAL_COUNT: 1 (처분 완료)
## WARNING_COUNT: 2 (처분 완료)
