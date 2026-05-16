# 신규 식별자 충돌 검토 결과

대상 문서: `plan/in-progress/spec-draft-cafe24-cleanup.md`
검토 일시: 2026-05-16

---

### 발견사항

- **[INFO]** CHANGELOG 항목에 드롭된 변경 3 내용이 잔류
  - target 신규 식별자: CHANGELOG 항목 내 `§5 Case 번호 연속화 (5.1·5.3·5.8 → 5.1·5.2·5.3)`
  - 기존 사용처: `plan/in-progress/spec-draft-cafe24-cleanup.md §변경 3` — "변경 3 은 적용하지 않는다"로 명시적으로 드롭 처리됨
  - 상세: draft 본문 §변경 3에서 Case 번호 연속화를 드롭(의도된 컨벤션 확인 후)했으나, 동일 문서 §CHANGELOG 추가 항목의 서술에는 `§5 Case 번호 연속화 (5.1·5.3·5.8 → 5.1·5.2·5.3)` 문구가 그대로 남아 있다. 실제 spec에 반영되지 않을 변경이 CHANGELOG에 기록되면, 문서 이력이 실제 상태와 불일치한다.
  - 제안: spec 반영 전 CHANGELOG 항목에서 `§5 Case 번호 연속화 (5.1·5.3·5.8 → 5.1·5.2·5.3).` 부분을 제거하고 INFO 4 (false positive 판정)를 간단히 언급하거나 생략한다.

---

### 충돌 없음 확인 항목

1. **§9.9 섹션 번호**: `spec/4-nodes/4-integration/4-cafe24.md`의 기존 Rationale 섹션은 §9.1~§9.8까지 존재하며, §9.9는 신규 번호다. 동일 파일에서 §9.9가 사용된 기존 사례 없음 — 충돌 없음.

2. **`Array<{key, value}>` 타입명**: 편집 버퍼 내부 구현 타입. spec 전체에서 같은 이름이 다른 의미로 등록된 사례 없음. 프론트엔드 내부 React state 패턴으로 공개 계약(API/데이터모델)에 노출되지 않음 — 충돌 없음.

3. **`Record<string, unknown>` 타입명**: `spec/4-nodes/4-integration/4-cafe24.md §1`의 `fields` 필드 타입으로 이미 정의된 기존 식별자이며, target이 새로 도입하는 이름이 아니다. 동일 타입이 여러 spec 파일에서 일관된 의미로 사용 중 — 충돌 없음.

4. **`config.fields`**: `4-cafe24.md`의 기존 config 필드명(L22, L85, L155, L208, L245 등)으로 target이 새로 도입하는 식별자가 아니다. `spec/4-nodes/6-presentation/4-form.md`에도 같은 이름이 존재하나, 각각 다른 노드의 config를 지칭하며 네임스페이스가 노드 단위로 분리되어 있어 충돌 아님.

5. **`KeyValueEditor` 컴포넌트명**: target §9.9에서 패턴 이름으로 언급. spec 전체에서 동일 이름으로 다른 의미가 정의된 사례 없음 — 충돌 없음.

6. **파일 경로**: 변경 대상 파일은 `spec/4-nodes/4-integration/4-cafe24.md` 단일 기존 파일이며, 신규 파일 생성이나 이름 변경 없음 — 파일 경로 충돌 없음.

7. **API endpoint / 이벤트명 / 환경변수**: target이 도입하는 변경(§2 설명 추가, §9.9 신설, §9.7 본문 위치 정정)은 코드/API/데이터모델 무변경으로 명시되어 있음. 신규 endpoint, 이벤트명, 환경변수 도입 없음 — 해당 없음.

---

### 요약

target(`spec-draft-cafe24-cleanup.md`)이 `spec/4-nodes/4-integration/4-cafe24.md`에 도입하는 신규 식별자는 §9.9 섹션 번호 하나뿐이며, 기존 §9.1~§9.8과 번호 충돌이 없다. 편집 버퍼 패턴(`Array<{key, value}>`, `Record<string, unknown>`, `config.fields`)은 기존에 정의된 타입이거나 일관된 의미로 재사용되는 것이어서 새 충돌이 발생하지 않는다. 단, draft의 CHANGELOG 항목에 실제 미적용된 "§5 Case 번호 연속화" 내용이 잔류하고 있어, spec 반영 전 정리가 필요하다. 식별자 충돌 관점에서 차단 수준의 이슈는 없다.

---

### 위험도

LOW
