# 신규 식별자 충돌 검토 결과

## 발견사항

충돌에 해당하는 항목이 없습니다.

---

### 검토 범위

target 변경은 `spec/conventions/spec-impl-evidence.md` §1 의 inclusive list 뒤에 blockquote 단락 하나를 삽입하고, 기존 `**제외**` 헤더 문구를 소폭 재작성한 것이 전부다. 이 변경이 도입하는 신규 식별자·개념은 아래 4가지다.

| 신규 식별자/개념 | 기존 사용처 | 판정 |
|---|---|---|
| `INCLUDE_PREFIXES` (spec 산문에 처음 명시) | `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:47` — 동일 이름의 `const INCLUDE_PREFIXES` 가 이미 구현 파일에 존재하며 spec-impl-evidence.md 를 SoT 로 선언함 | 충돌 없음 — spec 산문이 구현 상수 이름을 처음으로 직접 인용한 것. 의미 일치 |
| `spec/data-flow/**` (제외 대상 경로로 명시) | 실제 `spec/data-flow/` 폴더가 존재 (16개 파일, `0-overview.md` ~ `15-external-interaction.md`). `spec/0-overview.md §8 문서 맵` 에 `spec/data-flow/` 가 동일 의미로 등재돼 있음 | 충돌 없음 — 기존 폴더 경로를 그대로 참조 |
| "의도적 제외" (개념 용어) | 기존 spec 어디에도 동일 문구 미사용 | 충돌 없음 — 신규 설명 문구, 다른 의미로 선점된 사례 없음 |
| `**제외** (위 inclusive list 내부에서 추가로 빠지는 파일 — ...)` 헤더 재작성 | 구 헤더 `**제외** (가드 구현 spec-frontmatter-parse.ts 기준 — basename 매칭)` 을 대체. 의미 범위 동일 (basename/catalog 제외 목록 자체는 변경 없음) | 충돌 없음 — 동일 리스트에 대한 설명 표현 변경 |

---

### 관점별 확인

1. **요구사항 ID 충돌** — 해당 없음. target 에 새로운 요구사항 ID 가 부여되지 않았다.
2. **엔티티/타입명 충돌** — 해당 없음. 신규 타입/인터페이스가 없다.
3. **API endpoint 충돌** — 해당 없음. endpoint 관련 변경 없다.
4. **이벤트/메시지명 충돌** — 해당 없음.
5. **환경변수·설정키 충돌** — 해당 없음.
6. **파일 경로 충돌** — 해당 없음. 기존 파일 수정만, 새 파일 생성 없다.
7. **`INCLUDE_PREFIXES` 명칭** — spec 산문에서 처음 명시적으로 호명한 것이지만, 구현 파일의 동일 상수와 의미가 정확히 일치하고 SoT 역방향 참조 패턴(구현이 spec 을 SoT 로 선언 → spec 이 구현 상수명을 인용)으로 일관된다. 이 방향의 참조는 /Volumes/project/private/clemvion/.claude/worktrees/spec-dataflow-exclusion-note-08f8a5/codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts 3번 라인 `// SoT: spec/conventions/spec-impl-evidence.md` 가 이미 확립한 관계다.

---

## 요약

target(`spec/conventions/spec-impl-evidence.md`) 변경은 §1 inclusive list 뒤에 "list 외 영역은 의도적 제외이며 대표적으로 `spec/data-flow/**` 가 해당한다"는 blockquote 설명을 추가한 편집이다. 도입된 식별자(`INCLUDE_PREFIXES` 구현 상수 이름 인용, `spec/data-flow/**` 경로 참조)는 모두 기존 코드베이스·spec 에 동일 의미로 이미 존재하며 새로운 의미 도메인을 선점하지 않는다. 명명 충돌에 해당하는 항목이 존재하지 않는다.

## 위험도

NONE
