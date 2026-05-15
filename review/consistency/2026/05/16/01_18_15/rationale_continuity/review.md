# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-cafe24-private-followup.md`
기준 Rationale: `spec/2-navigation/4-integration.md` 및 보조 코퍼스 Rationale 발췌

---

### 발견사항

- **[INFO]** 변경 1 — 분기 ② `refetch 미실행` 결정의 Rationale 미기록
  - target 위치: 변경 1 `분기 ② — Cafe24 Private` 항목, "`refetch 미실행` — … 본 분기에서는 부모 페이지의 `onChanged()` 콜백을 호출하지 않는다"
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` ## Rationale, "Cafe24 Private request-scopes 흐름" 항
  - 상세: 기존 Rationale "Cafe24 Private request-scopes 흐름" 항은 begin 우회 결정·credentials.scopes 사전 갱신·응답 shape 을 설명하지만, `onChanged()` (부모 refetch 콜백) 를 분기 ② 에서 호출하지 않는 이유는 명시되지 않는다. target 의 "테스트 실행" 콜백 성공 시 별도 경로로 refresh 된다는 설명은 본문 인라인 주석으로만 등장한다. 위반이라기보다 Rationale 확장이 필요한 지점이다.
  - 제안: `spec/2-navigation/4-integration.md` Rationale "Cafe24 Private request-scopes 흐름" 항 또는 신규 sub-항에 다음을 보강한다 — "request-scopes 분기 ② 에서 onChanged() 를 호출하지 않는 이유: Cafe24 측 scope 활성화 + '테스트 실행' 완료까지 실제 token 변화가 없어 즉시 refetch 는 stale 결과를 반환. token 갱신은 install handler 의 callback 성공 시 별도 경로로 처리된다."

- **[INFO]** 변경 1 — `onMutate 에서 alert null 리셋` 신규 UI 결정의 Rationale 부재
  - target 위치: 변경 1 `분기 ② — Cafe24 Private`, "다음 mutate 시 reset — `onMutate` 에서 alert 를 null 로 리셋해 사용자가 새 요청을 시작하면 옛 안내가 사라진다."
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` ## Rationale 전체 (관련 항목 부재)
  - 상세: inline alert 의 생존 주기 정책(onMutate 리셋 vs 사용자 dismiss vs 다음 callback 성공 시 소거)은 기존 Rationale 에 정의된 바 없는 신규 결정이다. 기각된 대안 채택이나 invariant 위반은 아니지만, spec 본문에 반영될 때 이 결정의 근거가 Rationale 에 없어 추후 유지보수 시 재검토 없이 삭제될 수 있다.
  - 제안: spec 본문 반영 시 Rationale 에 alert 생존 주기 결정을 짧게 기록한다. 예: "inline alert 는 다음 mutate onMutate 시 리셋한다 — 사용자가 새 요청을 시작할 때 이전 안내가 잔존하면 상태 혼동을 유발하기 때문. toast.info 는 동시 발화해 즉각 신호를 주고, alert 는 참조 중 안내를 영구 제공하는 역할 분리."

- **[INFO]** 변경 2 — TOCTOU 부재 명시 추가의 Rationale 항목 참조 방향 점검
  - target 위치: 변경 2 항목 3, "TOCTOU 부재 명시 (consistency I-5) — 회복 분기는 SELECT + HMAC verify 만 수행하는 read-only 조회로, INSERT/UPDATE 가 없어 TOCTOU 위험이 없음을 한 문장 추가."
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` ## Rationale, "Cafe24 install_token mismatch 회복 흐름" 항 ("비용: O(N) HMAC verify (회복 분기에서만, 정상 흐름 zero impact)")
  - 상세: 회복 흐름이 SELECT + HMAC verify only 임은 Rationale 에 기술되어 있으나, 이것이 TOCTOU 위험 부재와 직접 연결된다는 명시는 없다. target 이 추가하려는 한 문장은 기존 Rationale 의 논리를 연장할 뿐이며 위반이 아니다. 단, Rationale "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 의 mall_id 비교 경로" 항이 begin 핸들러의 TOCTOU 차단(V045 partial UNIQUE + backstop) 을 명시하고 있어, 회복 분기의 TOCTOU 부재 이유가 서로 다른 보증 원리(partial UNIQUE vs read-only 조회)임을 구분해 표기하면 혼동이 없다.
  - 제안: 추가할 한 문장에 "begin 핸들러의 V046 partial UNIQUE backstop 과는 다른 보증 원리 — 회복 분기 자체가 INSERT/UPDATE 없는 read-only 조회이므로 race 자체가 발생하지 않는다"는 구분을 포함한다.

---

### 요약

target 문서의 세 가지 변경은 모두 `spec/2-navigation/4-integration.md` 의 기존 Rationale 에서 기각된 대안을 재도입하거나 합의된 invariant 를 위반하는 내용을 포함하지 않는다. 변경 1 의 분기 ② UI 결정(inline alert 영구 표시, toast.info 병행, refetch 미실행)은 Rationale "Cafe24 Private request-scopes 흐름" 항의 "우리 화면은 안내만 담당" 원칙과 정합하며, 변경 2 의 cross-reference 보강과 TOCTOU 명시는 기존 Rationale 의 논리를 보완하는 방향이다. 변경 3 은 경로 형식 교정으로 Rationale 연속성과 무관하다. 다만 분기 ② 의 `onChanged()` 미호출 결정 근거와 alert 생존 주기 정책이 Rationale 에 기록되지 않아 spec 반영 시 함께 보강하면 향후 유지보수 시 재검토 없이 삭제되는 위험을 줄일 수 있다.

### 위험도

LOW
