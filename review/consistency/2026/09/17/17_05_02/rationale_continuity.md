# Rationale 연속성 검토 — spec-draft-deletion-releases-trigger-resources (2회차)

## 발견사항

- **[INFO]** 1차 `--spec` CRITICAL(`review/consistency/2026/09/17/16_32_44`)의 "고아 secret 재생산" 지적이 D4~D6 의 인터리빙 논증으로 실질 해소됐다 — 검증 근거를 기록해 둔다
  - target 위치: `plan/in-progress/spec-draft-deletion-releases-trigger-resources.md` §D4("`secret_store` 비밀은 행 삭제가 커밋된 뒤에 지운다") · §D5("쓰기 경로의 보상" 인터리빙 표) · §D6(부모 잠금 뒤 열거) · §D7(남는 창 표)
  - 과거 결정 출처: `review/consistency/2026/09/17/16_32_44/rationale_continuity.md` CRITICAL — "새 삭제 경로가 `plan/complete/trigger-config-lost-update.md` 의 5라운드 W1 defer 항목(secret store 쓰기·provider 등록의 원자성)을 인용·해소 없이 확장해 같은 클래스의 고아 secret 을 재생산할 수 있다"
  - 상세: 재검토 결과 D5 의 인터리빙 표(`A`=비밀 쓰기 커밋, `T`=행 삭제 커밋, `S`=행 삭제 뒤 prefix 삭제, `R`=락 안 재기록)는 1차 CRITICAL 이 지목한 정확한 시나리오("행이 아직 있어 쓰기가 정상 성공하지만 그 직후 cleanup·CASCADE 로 무의미해지는" 경합)를 닫는다 — `deleteByPrefix` 가 **시점이 아니라 trigger id 접두사**로 지우므로, `A`(비밀 쓰기)가 `S`(정리) 이전에 커밋되기만 하면 `S` 가 그 비밀을 함께 쓸어간다. `A` 가 `S` 뒤에 커밋되려면 인과상 `T`(행 삭제)가 이미 커밋된 뒤여야 하고, 그 경우 `R`(락 안 재읽기)은 행 부재를 보고 `false` → `C`(보상 삭제)가 대신 지운다. D6 이 "부모 행을 잠근 뒤 같은 트랜잭션에서 열거"해 **기존 트리거가 열거에서 빠지는 경우가 없음**을 보장하므로, 이 인터리빙 논증이 실제로 성립할 전제(모든 관련 트리거가 `S` 대상에 포함됨)도 갖춰져 있다. **`--impl-done` 게이트가 다음 라운드에서 이 인터리빙을 e2e 로 실증하는지 재확인할 필요는 있다** — D5 자체가 T2(트래커 신설 항목)의 "e2e(… 재진입으로 끊은 동시 회전의 보상)"를 구현 검증 대상으로 이미 지정해 뒀다.
  - 제안: 조치 불필요 — T2 e2e 항목이 이 인터리빙 논증을 커밋 시점에 실증하는지만 `--impl-done` 단계에서 확인.

- **[INFO]** "«비활성화» 를 제품 의도가 아니라 오기로 판정한 이유" — 근거가 되는 부재(negative) 확인이 정확함을 교차 검증
  - target 위치: §Rationale "«비활성화» 를 제품 의도가 아니라 오기로 판정한 이유"
  - 과거 결정 출처: `spec/2-navigation/1-workflow-list.md` 의 `## Rationale` (전체 4항목)
  - 상세: `1-workflow-list.md` 의 기존 Rationale 4항목("공유" 정의·import permissive·폴더 계층·태그 필터 하향)의 어디에도 "트리거를 비활성 상태로 남긴다"는 의도적 설계 결정이 없음을 직접 확인했다(grep — 목록 액션 표 문장 외 "비활성화" 0건). target 의 주장대로 이 문구는 채택된 설계가 아니라 drift 이므로, D2/S1 이 이를 뒤집는 것은 "무근거 번복"이 아니라 "최초 확정"이라는 target 의 자체 논증이 성립한다.
  - 제안: 없음 (확인만).

- **[INFO]** D4 의 "같은 트랜잭션 안에서 지우지 않는 이유"(`SecretResolver` 백엔드 비의존)와 D3 의 "외부 호출은 락 밖"(Cafe24 advisory lock 기각 선례) 인용이 실제 Rationale 원문과 일치
  - target 위치: §D3, §D4
  - 과거 결정 출처: `spec/conventions/secret-store.md §3.4`("SecretResolver interface 자체는 PostgreSQL 결합 없음"), `spec/2-navigation/4-integration.md` §"Cafe24 token refresh" Rationale("PostgreSQL advisory lock… lock 보유 중 HTTP 요청을 transaction 안에 묶어야 해 DB 커넥션 점유 시간이 늘고")
  - 상세: 두 인용 모두 원문과 정확히 부합한다. 특히 `secret-store.md §R4`("`ON DELETE CASCADE` 는 채택하지 않는다 — implicit DB 동작과 explicit application 동작이 섞이면 추적이 어려워지기 때문")가 세운 "explicit application-level cleanup" 원칙도 D4~D6(행 삭제는 FK CASCADE 에 맡기되, `secret_store` 정리는 여전히 명시적 `deleteByPrefix`)이 그대로 유지한다 — DB CASCADE 로 대체하지 않았다.
  - 제안: 없음 (확인만).

## 요약

1차 `--spec` 이 CRITICAL 로 지목했던 "고아 secret 재생산" 우려는 이번 개정판에서 D4(정리 시점을 행 삭제 커밋 뒤로 통일)·D5(쓰기 경로 보상 + 인터리빙 논증)·D6(부모 행을 잠근 뒤 같은 트랜잭션에서 트리거 열거)·D7(남은 창을 창 1~3 으로 명시하고 각각 처분을 적음)로 새 Rationale 과 함께 실질적으로 해소됐다 — 특히 D7 은 "provider 등록 쪽 절반"을 여전히 미루면서도 그 사실과 이유를 침묵하지 않고 명시해, 메모리에 기록된 "유예는 실측·명시가 필요" 원칙을 지킨다. `secret-store.md §R4`(explicit cleanup, CASCADE 미채택)·`§3.4`(백엔드 비의존)·`spec/2-navigation/4-integration.md`(외부 호출을 락에 넣지 않는다)의 기존 원칙은 인용대로 정확히 이어받았고, "«비활성화»" 문구가 채택된 설계가 아니라 drift였다는 target 의 주장도 `1-workflow-list.md` 의 실제 Rationale 4항목 전수 확인으로 뒷받침된다. D2(트리거별 개별 DELETE 호출 기각)·D4 하단의 "철회한 1차안"은 이 draft 자신의 새 결정이거나 1차 라운드 자기 정정이라 실제 이력에 근거하며 지어낸 선례가 아니다. `secret_store` 정리 시점을 "행 삭제 전"에서 "행 삭제 커밋 뒤"로 뒤집는 것(D4)은 기존 spec 본문(§4.4 「락 대기 상한 5초」)과 다르지만, 그 본문은 별도 Rationale 근거 없이 현재 구현을 그대로 서술한 문장이었고(가장 최근 커밋 `217fadecb`/`bf135ac5c` 도 "동작 서술"로만 명시) target 은 그 문장 자체를 S3 으로 함께 고치므로 "합의된 Rationale 원칙 위반"에는 해당하지 않는다. Rationale 연속성 관점에서 이 개정판은 기각된 대안의 재도입이나 무근거 번복 없이 이전 지적을 정면으로 흡수했다.

## 위험도
LOW
