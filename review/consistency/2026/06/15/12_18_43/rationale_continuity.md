# Rationale 연속성 검토 결과

검토 모드: `--impl-done`, scope=`spec/3-workflow-editor/3-execution.md`, diff-base=`f34ae00`

---

### 발견사항

- **[INFO]** clone 이름 자동 넘버링을 "클라이언트 책임"으로 넘긴 것의 Rationale 부재
  - target 위치: `workflow-test-datasets.service.ts` `copyName()` 메서드 주석 (`번호 증가("이름 (Copy 2)") 재시도는 클라이언트 책임`)
  - 과거 결정 출처: `spec/3-workflow-editor/3-execution.md` `## Rationale` R-2.2 — 클론 이름 처리 정책 미기술. 한편 `§9 API 표` 는 clone 시 "동일 이름 복제본 이미 존재 시 409 `DUPLICATE_NAME`" 만 명시하고, 재시도 책임 배분에 대한 언급이 없다.
  - 상세: 구현 코드 주석과 문서(`.en.mdx` / `.mdx`: `"If a dataset with that name already exists you'll get a 409 error — rename and clone again."`)는 이름 충돌 재시도를 클라이언트에 위임한다고 명시한다. 이 결정은 R-2.2 Rationale에 기록되지 않았다. 기각된 대안("서버가 자동으로 번호 증가")이 있는지 불분명하지만, 동일 패턴이 spec에 없으므로 Rationale 공백이다.
  - 제안: `spec/3-workflow-editor/3-execution.md § Rationale R-2.2`에 clone 이름 충돌 처리 정책(서버는 `(Copy)` suffix 단일 시도 후 409 반환, 번호 증가 재시도는 클라이언트 책임, 이유: 서버 루프 로직의 복잡도 및 성능 우려)을 한 항으로 추가.

- **[INFO]** 목록 soft limit 200 의 Rationale 부재
  - target 위치: `workflow-test-datasets.service.ts` `list()` 메서드 주석 (`방어적 상한 200행 — … 페이지네이션 없이도 운영에 문제없으나 DoS 방지를 위한 소프트 리미트`)
  - 과거 결정 출처: `spec/3-workflow-editor/3-execution.md §9` API 표 — 목록 API에 limit/페이지네이션 여부 미기술.
  - 상세: 구현은 취급 한도 200과 페이지네이션 미도입을 "정상" 으로 선언하나, spec에 해당 결정이 없다. 기각된 대안(페이지네이션 도입)이 spec Rationale에 없으므로 연속성 판단 불가. CRITICAL 수준은 아니나(거부된 원칙을 재도입한 게 아니라 신규 결정), 합의된 Rationale 없이 구현 단독 결정이 내려졌다.
  - 제안: `spec/3-workflow-editor/3-execution.md § Rationale R-2.2` 또는 §9 비고에 "목록 응답 최대 200행 soft limit, 페이지네이션 미도입 — 워크플로우당 수십 건 이하로 예상되므로 충분, DoS 방지용" 을 명시.

---

### 요약

구현 변경(V097 마이그레이션, `WorkflowTestDatasetsModule`, `editor-toolbar.tsx` 데이터셋 UI)은 `spec/3-workflow-editor/3-execution.md § Rationale R-2.2`에 명문화된 핵심 결정들(유저 귀속 기본 private, 워크스페이스 공유 read-only, clone 후 자기 소유, `(workflow_id, owner_id, name)` UNIQUE, Editor+ 통일)을 빠짐없이 충실히 따른다. 명시적으로 기각된 대안의 재도입이나 합의된 invariant 위반은 없다. 다만 구현이 독자적으로 결정한 두 가지 세부 사항(clone 이름 충돌 시 클라이언트 재시도 위임, 목록 200행 soft limit + 페이지네이션 미도입)이 spec Rationale에 기록되지 않아 미래 유지보수자가 "기각된 대안인가 신규 결정인가"를 판단하기 어려운 소규모 공백이 있다. 이는 INFO 수준이며, 기존 합의를 무너뜨리거나 과거 결정을 무근거 번복하는 사례는 없다.

### 위험도

LOW
