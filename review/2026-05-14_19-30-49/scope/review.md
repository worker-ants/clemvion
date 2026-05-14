## 발견사항

### [INFO] `review/consistency/` 다중 세션 산출물 (파일 1–31)
- **위치**: `review/consistency/2026-05-14_17-49-11/`, `17-58-37/`, `18-15-41/`, `18-23-55/`, `18-38-32/`
- **상세**: 5개 세션의 consistency check 산출물이 모두 포함. CLAUDE.md 규약상 `review/consistency/<timestamp>/` 경로에 저장하는 것이 정식 경로이며, `--spec` → BLOCK: YES(17-58-37) → 수정 → BLOCK: NO(18-15-41 이후) 흐름이 확인된다. 의도된 범위 내 산출물.
- **제안**: 없음.

---

### [WARNING] `spec/conventions/cafe24-api-metadata.md` — 규약 파일이 spec 패치에 혼재
- **위치**: 파일 35, `§6` 용어 note 추가
- **상세**: `cafe24-api-metadata.md`는 모든 spec에서 참조하는 공유 규약 파일이다. consistency check 18-15-41 세션(I2)에서도 "규약 파일 수정이 spec 패치에 혼재 — 리뷰어가 spec 변경과 규약 변경을 구분 없이 일괄 적용할 위험" 이라고 직접 지적했다. 변경 자체는 기존 §6 본문과 충돌 없는 명시 추가이나, 이 변경이 `project-planner` 역할의 spec write와 같은 커밋에 묶이면 이력 추적이 어려워진다.
- **제안**: 별도 커밋으로 분리하거나, spec draft 상단에 "규약 파일 수정 포함" 명시 (이미 consistency check에서 권고한 내용과 동일).

---

### [INFO] `spec/4-nodes/4-integration/4-cafe24.md` — CHANGELOG 복수 항목이 동일 날짜에 합산
- **위치**: 파일 34, 마지막 CHANGELOG 행 (`2026-05-14` 2번째 줄)
- **상세**: 2026-05-14 항목이 두 개로 분리되지 않고 하나의 긴 문장에 여러 변경을 모두 병기했다. 가독성 저하이나 정보 누락은 없다.
- **제안**: 선택 사항. 향후 CHANGELOG 추가 시 항목당 1행 원칙 적용 권장.

---

### [INFO] `spec/data-flow/integration.md` — diff 미제공으로 완전 검토 불가
- **위치**: 파일 36 (diff omitted due to prompt size limit)
- **상세**: data-flow spec은 consistency check 세션 전반에 걸쳐 `§1.2/§1.4/§2.1/§3.2` 변경이 핵심 DRAFT(3A~3D)로 다뤄졌다. diff가 잘려 범위 일탈 여부를 직접 확인할 수 없다.
- **제안**: 별도로 `spec/data-flow/integration.md` diff만 추가 검토 권장.

---

### [INFO] `spec/2-navigation/4-integration.md` — diff 미제공으로 완전 검토 불가
- **위치**: 파일 33 (diff omitted due to prompt size limit)
- **상세**: consistency check 18-38-32 세션에서 §11.1·§10.3·§5.8·§13 등 4곳의 cross-spec 불일치가 WARNING으로 지적되었다. 해당 수정이 포함되었는지 확인 불가.
- **제안**: 동일하게 별도 검토 권장. 특히 §10.3의 `oauth_preview` → `provider_meta` 수정, §11.1의 `pending_install` TTL 스캔 블록 추가 포함 여부 확인 필요.

---

## 요약

변경 파일 전체가 `spec/`, `review/consistency/` 두 경로에 국한되어 있으며, `frontend/`·`backend/` 코드 변경 없다. review 산출물은 CLAUDE.md에서 요구하는 정식 경로에 저장되었고, spec 변경(data-model·integration·cafe24·data-flow)은 `cafe24-pending-polish` 작업의 핵심 목표(pending_install 흐름 정비, install_token 도입, callback 실패 처리, TTL 만료)와 직접 부합한다. 실질적 범위 일탈은 없으며, 규약 파일(`cafe24-api-metadata.md`) 수정이 spec 패치와 혼재한다는 점만 경미한 관리 위험으로 남는다.

## 위험도

**LOW**