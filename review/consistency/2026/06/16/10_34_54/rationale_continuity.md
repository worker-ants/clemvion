# Rationale 연속성 검토 결과

검토 대상: `spec/2-navigation/6-config.md`
검토 모드: spec draft 검토 (--spec)

---

## 발견사항

### 발견사항 없음 (정상)

검토 결과 기각된 대안의 재도입, 합의된 원칙 위반, 무근거 번복, 암묵적 가정 충돌에 해당하는 항목이 발견되지 않았다.

주요 검토 항목별 판정:

**R-1 (기본 모델 select-only 정책)**: target 은 이 정책을 유지하며, Rerank 탭만 자유 입력을 허용하는데 이는 동일 R-1 Rationale 내에서 "리랭커 provider 는 표준 model-list API 가 없어" 예외로 명시된 것과 완전히 일치한다. 기각된 "자유 입력 fallback" 대안이 Chat/Embedding 탭에 재도입된 흔적은 없다.

**R-2 (AuthConfig RBAC — 변경 액션 Admin+ UI 가드)**: 이번 diff 의 핵심 변경으로, 종전 "Reveal 만 Admin+" 비대칭을 "모든 mutation 버튼 Admin+" 로 확장했다. R-2 Rationale 의 마지막 bullet("변경 액션 버튼 전체를 Admin+ UI 가드로 통일")이 이 결정을 새 Rationale 로 동반 기록하고 있어 무근거 번복이 아니다. §3.2 권한 매트릭스(Auth Config: Owner/Admin = CRUD, Editor/Viewer = R)와 일치하며 합의된 invariant 를 강화하는 방향이다.

**R-3 (ModelConfig 단일화 번복)**: 이전 결정(RerankConfig 분리·piggyback)의 폐기가 R-3 에 "이전 결정(폐기)" + "번복 결정" + "번복 근거"로 명시적으로 기술되어 있다. 새 Rationale 부재 없음.

**R-4 (cohere Base URL 정책)**: 종전 서술 오류 정정이 R-4 에 근거 명시 후 갱신됐다.

**R-5 (max_tokens 4096 정정)**: 구 spec 의 2048 이 다시 등장하지 않는다. R-5 에서 SPEC-DRIFT 수정임을 명시했다.

**R-6 (소스 IP·응답 코드)**: 종전 "Planned" 항목의 구현 승격이며 기각된 대안(전용 call-log 엔티티) 을 재도입하지 않는다.

**LLM Client §6 에러 코드 cross-reference**: R-1 이 `LLM_MODEL_NOT_FOUND`(404) 를 "Planned" 로 참조하는데, 현재 `spec/5-system/7-llm-client.md §6` 에 동일하게 "미구현(Planned)" 로 기술되어 있어 cross-spec 정합이 유지된다.

---

## 요약

`spec/2-navigation/6-config.md` 의 이번 변경(status `partial→implemented` 승격, RBAC UI 가드 전면화, API 테이블 권한 표기 정비)은 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 설계 원칙을 위반하지 않는다. 유일하게 구 권한 서술("Owner / Admin → Reveal 버튼 노출 + 호출 가능")을 확장 교체한 부분은 새 Rationale bullet(R-2 마지막 항)을 함께 작성해 번복 근거를 명시했으므로 "무근거 번복" 요건을 충족하지 않는다. Rationale 연속성 관점에서 발견된 위반은 없다.

---

## 위험도

NONE
