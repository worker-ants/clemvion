## Cross-Spec Consistency Check — `spec/1-data-model.md` (--impl-prep)

---

### 발견사항

---

- **[WARNING] 핵심 참조 spec 2종 미포함으로 완전 검증 불가**
  - target 위치: `spec/1-data-model.md` §2.10 Integration — `install_token`, `install_token_issued_at`, `mall_id` 필드 전체
  - 충돌 대상: `spec/2-navigation/4-integration.md` (git status `M`), `spec/data-flow/integration.md` (git status `M`)
  - 상세: 신규 필드 3종이 각각 `[Spec 통합 화면 §6]`, `[§9.2 API]`, `[§10.4 에러 매핑]`, `[§5.8 Cafe24]`를 primary reference로 열거하고 있으나, 해당 파일들이 검토 컨텍스트에 제공되지 않음. 두 파일 모두 현 브랜치에서 동시 수정 중이므로 데이터 모델과 내비게이션·데이터플로우 스펙 간 정합성을 현재 컨텍스트에서 완전히 보장할 수 없음.
  - 제안: `spec/2-navigation/4-integration.md` §5.8, §6 상태 전이, §9.2, §10.4 및 `spec/data-flow/integration.md`를 포함한 재검토 필요.

---

- **[INFO] `mall_id` UNIQUE 인덱스에 내포된 비즈니스 규칙 — spec 명시 위치 미확인**
  - target 위치: `spec/1-data-model.md` §3 인덱스 테이블, `(workspace_id, mall_id) WHERE ... UNIQUE` 항목 주석
  - 충돌 대상: `spec/2-navigation/4-integration.md` §5.8 (Cafe24) — 미제공
  - 상세: "한 workspace 안에서 같은 mall_id 의 cafe24 통합은 최대 1행 (public 과 private 동시 보유 불가)" 라는 비즈니스 규칙이 인덱스 설명에만 삽입되어 있고, 이 규칙이 통합 화면 스펙에서 명시적으로 기술되어 있는지 현 컨텍스트에서 검증 불가.
  - 제안: `spec/2-navigation/4-integration.md` §5.8에 public/private 중복 설치 불가 규칙이 명시되어 있으면 정합, 누락이면 해당 섹션에 보강 필요.

---

- **[INFO] `install_token_issued_at` NULL 전이 조건 — TTL 만료 시 기술 누락**
  - target 위치: `spec/1-data-model.md` §2.10 `install_token_issued_at` 필드 설명
  - 충돌 대상: 동일 문서 `install_token` 필드 설명 ("callback 성공 **또는 TTL 만료** 시 NULL")
  - 상세: `install_token` 필드는 "callback 성공 또는 TTL 만료 시 NULL"로 기술되어 있으나, `install_token_issued_at`는 "callback 성공 시 NULL"만 명시하고 TTL 만료 시 동작(NULL로 갱신 vs. 유지)이 기술되어 있지 않음. 스캐너가 만료 처리 후 `install_token_issued_at`를 NULL로 정리하는지, 아니면 감사 목적으로 보존하는지 불명확.
  - 제안: 만료 시 보존(감사 목적) 의도라면 "TTL 만료 시 유지 (감사 보존)" 한 줄 추가. 정리 의도라면 "callback 성공 또는 TTL 만료 시 NULL"로 수정.

---

- **[INFO] `spec/0-overview.md` §6.3 Cafe24 로드맵과 신규 필드 정합**
  - target 위치: `spec/1-data-model.md` §2.10 신규 필드 3종
  - 충돌 대상: `spec/0-overview.md` §6.3 "Cafe24 통합 — spec 완료(2026-05-13). 후속 implementation 진행 예정"
  - 상세: 데이터 모델의 V044·V045 필드 추가는 overview의 "후속 implementation 진행 예정" 상태와 일치하며 모순 없음. CRITICAL 아님, 기록 목적 INFO.

---

- **[INFO] V043 인덱스 참조 — 선행 마이그레이션 존재 전제**
  - target 위치: `spec/1-data-model.md` §3 인덱스 테이블, `(install_token) WHERE install_token IS NOT NULL | V043`
  - 충돌 대상: 현 브랜치 미제출 파일 목록 (V043 파일 없음)
  - 상세: git status 에 V044·V045 마이그레이션만 신규 파일로 보이고, V043은 이미 commit된 것으로 추정. 단, 검토 컨텍스트에서 V043 내용을 확인할 수 없어 `install_token` 컬럼 추가가 V043에서 올바르게 이루어졌는지 현재 검증 불가.

---

### 요약

`spec/1-data-model.md`의 신규 필드(`install_token_issued_at` V044, `mall_id` V045)는 **제공된 스펙 범위 내에서 직접적인 CRITICAL 모순이 발견되지 않는다**. 그러나 신규 필드들의 핵심 cross-reference 문서인 `spec/2-navigation/4-integration.md`와 `spec/data-flow/integration.md`가 검토 컨텍스트에 포함되지 않아 완전한 검증이 불가하다. `install_token_issued_at`의 TTL 만료 시 NULL 전이 여부와 `mall_id` public/private 동시 보유 불가 규칙의 spec 명시 위치는 구현 착수 전 확인이 권장된다.

### 위험도

**LOW** — CRITICAL 위배 없음. 핵심 참조 spec의 별도 검토 후 구현 착수 권장.