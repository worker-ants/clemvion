# Rationale 연속성 검토 — integration-attention-filter

검토 모드: `--impl-prep`
대상 문서: `spec/2-navigation/4-integration.md`
구현 계획: `plan/in-progress/integration-attention-filter.md`

> **참고**: target 문서 diff 가 "(없음)" — `spec/2-navigation/4-integration.md` 자체는 아직 변경되지 않았다. 본 검토는 구현 계획서(`integration-attention-filter.md`)가 기존 spec Rationale 에 기록된 결정과 충돌하지 않는지를 사전 점검한다.

---

### 발견사항

- **[WARNING]** `§2.4` 배너 클릭 동작 번복 — Rationale 신규 작성 예고 있으나 아직 미작성
  - target 위치: `plan/in-progress/integration-attention-filter.md` §적용 안 A > 프론트 (배너 클릭 동작), §Spec 갱신 (project-planner 위임 예정) §2.4
  - 과거 결정 출처: `spec/2-navigation/4-integration.md §2.4` 현행 텍스트 — "클릭 시 상태 필터를 `Expiring | Expired | Error`로 자동 전환"
  - 상세: 현행 spec §2.4 는 클릭 시 `Expiring | Expired | Error` 세 개의 개별 상태로 필터가 전환된다고 명시한다. 구현 계획은 이를 단일 `attention` 합집합 필터(`updateParam("status", "attention")`)로 교체하는 방향이다. 이것은 기존 상태 필터 동작 방식의 번복(개별 세 칩 전환 → 단일 합집합 칩 전환)이며, spec의 운용 모델이 바뀌는 것이다. 계획서 내에 "Spec 갱신 (project-planner 위임 예정)" 항목이 있어 의도된 번복임은 분명하나, 아직 spec §2.4 와 Rationale 에 그 이유("왜 합집합 필터를 단일 상태로 노출하는가 — 단일 칩 + 다중 status 의 표현 한계")가 반영되지 않은 상태로 구현이 먼저 착수될 위험이 있다.
  - 제안: 구현 착수 전 `project-planner` 를 통해 spec §2.4 및 Rationale 를 선행 갱신한다. `consistency-checker --spec` 이 그 갱신 이후에 통과해야 구현 계획의 spec 정합 조건이 완성된다. 계획서가 이 순서를 "project-planner 위임 예정"으로 열거하고 있으므로, 해당 spec 갱신 PR 이 merge 되기 전 구현 코드 PR 이 선행되지 않도록 순서를 잠가야 한다.

- **[WARNING]** 단일 건 점프(`/integrations/<id>` 직행) 결정에 대한 Rationale 부재
  - target 위치: `plan/in-progress/integration-attention-filter.md` §적용 안 A > 프론트 — "단일 건일 때: 클릭 시 `/integrations/<id>` detail 페이지로 직접 점프 (필터링 단계 생략)"
  - 과거 결정 출처: `spec/2-navigation/4-integration.md §2.4` — 기존 Rationale 에는 배너 클릭의 네비게이션 패턴(목록 필터 vs 직행) 에 대한 결정 근거가 없음
  - 상세: 이것은 신규 UX 결정이다. 기각된 대안을 재도입하는 것은 아니지만, "건 수에 따라 클릭 목적지가 달라진다"는 동작 분기는 사용자가 직관적으로 이해해야 하는 인터랙션 패턴이다. 이 결정을 설명하는 Rationale("필터 거치는 것이 1건일 때는 마찰, 직행이 더 유용")이 spec 문서에 존재하지 않으므로 향후 유지보수 시 번복 위험이 있다.
  - 제안: spec §2.4 갱신 시 "단일 건일 때 detail 직행" 결정과 그 근거를 Rationale 에 함께 명시한다.

- **[INFO]** `install_timeout` expired 행이 `attention` 필터에 포함되는 의도 확인 필요
  - target 위치: `plan/in-progress/integration-attention-filter.md` §백엔드 — `status IN ('expired','error')` 쿼리
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "install_timeout 알림 미발사" (§11.2) — "(b) UI 통지 충분 — 통합 상세 페이지의 status 배지 + 목록 페이지의 'Need attention' 배너로 통지"
  - 상세: `install_timeout` Rationale 은 알림을 미발사하되 "Need attention 배너로 통지 충분"이라고 명시해, `expired(install_timeout)` 행이 배너에 노출되어야 함을 의도한다. 구현 계획의 `status IN ('expired','error')` 쿼리는 `status_reason` 구분 없이 모든 `expired` 행을 포함하므로 `install_timeout` 도 자동으로 포함된다. 이는 Rationale 의도와 일치한다. 다만 plan 의 §배경 설명("spec §2.4 는 이미 'Expiring | Expired | Error'로 자동 전환을 명시")과 이 세 상태가 attention 에 합산되는 정의 사이에서 `install_timeout expired` 가 명시적으로 언급되지 않아 구현자가 의도를 오인할 여지가 있다.
  - 제안: spec §2.4 갱신 시 "expired(install_timeout) 포함 의도" 를 명시하거나 백엔드 코드 주석으로 안내한다.

- **[INFO]** 옛 폐기된 "100건 mall_id 스캔 + trial HMAC" 과 회복 분기의 형태 유사성 — 구현 간 혼동 주의
  - target 위치: 본 구현 계획 범위 외 사항이나, 이번 impl-prep 의 Rationale 코퍼스에 포함됨
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "install_token 을 App URL path 식별 키로 승격" 및 "Cafe24 install_token mismatch 회복 흐름 — 보안 전제"
  - 상세: 기존 Rationale 가 폐기된 O(N) 스캔과 현재 `tryRecoverByMallId` 회복 분기를 "형태는 비슷하나 본질적으로 다른 경로"로 구분해 명시적으로 설명하고 있다. 이번 attention-filter 구현 자체와는 직접 충돌하지 않으나, 동일 서비스 파일을 수정할 때 개발자가 두 경로를 혼동할 수 있으므로 Rationale 구분 주석을 코드 레벨에서도 확인할 것을 권장한다.
  - 제안: 구현 시 `tryRecoverByMallId` 인근 코드에 "폐기된 O(N) 스캔 아님 — fallback only" 주석이 존재하는지 확인한다.

---

### 요약

이번 구현 계획(`integration-attention-filter`)이 제안하는 핵심 변경 — `attention` 합집합 필터 신설, 배너 클릭 동작 변경, 분해 카운트 표시 — 은 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 시스템 invariant 를 깨는 문제는 없다. 다만 spec §2.4 의 현행 클릭 동작("세 개 필터 전환") 이 "단일 attention 필터 전환"으로 번복되는 것이 구현보다 spec Rationale 갱신이 선행되지 않은 상태이고, 단일 건 직행 결정에 대한 Rationale 도 아직 미기재 상태다. 계획서가 이를 인식하고 "project-planner 위임 예정"으로 명시한 점은 긍정적이나, spec PR 과 구현 PR 의 순서가 뒤바뀌지 않도록 주의해야 한다. `pending_install` 을 attention 에서 제외한 결정은 기존 Rationale ("pending_install 은 필터 칩에 추가하지 않는다") 과 정합하며, `install_timeout expired` 포함 의도도 Rationale 과 일치한다.

### 위험도

LOW
