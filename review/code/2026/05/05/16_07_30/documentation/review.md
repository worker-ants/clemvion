## 발견사항

### **[INFO]** `uniqueSlug` 길이 절단 동작 문서 미흡
- **위치**: `button-slug.util.ts:37` — `uniqueSlug` 함수
- **상세**: 64자 상한 절단 시 suffix(`-2` 등)가 suffix 포함 기준으로 잘리는지, base 기준으로 잘리는지 명시 없음. `result.length > 64 ? result.slice(0, 64)` 는 suffix 포함 전체를 자르므로 `-2` 접미사가 잘릴 수도 있다. 테스트에서는 이 동작을 커버하지만 독스트링에 언급 없음.
- **제안**: 함수 위에 주석 추가: "suffix 포함 전체 길이가 64를 초과하면 결과 전체를 64자로 절단한다 — base 의 마지막 몇 자가 잘릴 수 있다."

---

### **[INFO]** `normalizeButtonsArray` 에 Pass 1 / Pass 2 구조 미문서화
- **위치**: `button-slug.util.ts:58–88` — `normalizeButtonsArray` 함수
- **상세**: 살아있는 id를 먼저 `taken`에 reserve하는 2-pass 로직이 코드 내 인라인 주석(`Pass 1: 살아있는 id 는 미리 reserve 해 충돌 회피`)으로만 설명되어 있고, Pass 2에 대한 대응 주석이 없어 의도를 파악하기 위해 코드 전체를 읽어야 한다.
- **제안**: `// Pass 2: 빈 id 채움 — Pass 1 에서 reserve 된 id 와 충돌 없이` 주석 추가.

---

### **[INFO]** `migrate-button-ids.ts` 스크립트의 롤백 절차 누락
- **위치**: `backend/scripts/migrate-button-ids.ts:1–30` — 파일 상단 JSDoc
- **상세**: `--apply` 후 문제가 발생했을 때의 롤백 방법이 문서화되어 있지 않다. 프로덕션 DB를 직접 수정하는 일회성 스크립트이므로 롤백 지침(또는 "백업 후 실행" 권고)이 Usage 섹션에 있어야 한다.
- **제안**: Usage 섹션에 추가:
  ```
  # 권장: 실행 전 DB 백업 또는 트랜잭션 롤백 준비.
  # 롤백: audit_log 의 metadata.nodes_updated 를 참고해
  #        영향 노드의 config 를 수동 복원하거나 pg_dump 스냅샷 활용.
  ```

---

### **[INFO]** `migrate-button-ids.spec.ts` 의 파일 경로 위치 불일치
- **위치**: `backend/src/scripts/migrate-button-ids.spec.ts:1` 및 import 경로
- **상세**: 스크립트 자체는 `backend/scripts/`에 있으나, spec 파일은 `backend/src/scripts/`에 위치한다. 파일 상단 JSDoc("Unit tests for the pure backfill logic in `migrate-button-ids.ts`")에 "왜 `src/` 하위에 두었는지"가 설명되어 있지 않아, 다음 기여자가 경로 불일치를 버그로 오인할 수 있다.
- **제안**: JSDoc에 한 줄 추가: "스크립트 원본(`backend/scripts/`)을 Jest 가 직접 import 할 수 있도록 `src/` 하위에 배치."

---

### **[INFO]** `shadow-workflow.ts` 의 F-2 인라인 주석이 `button-slug.util` 명시 부재
- **위치**: `shadow-workflow.ts` `addNode` / `updateNode` 의 F-2 주석 블록
- **상세**: 주석에 "carousel/chart/table/template 만 적용 (button-slug.util 의 BUTTON_NODE_TYPES)" 라고 언급하지만, 실제 정책 기준 파일인 `button-slug.util.ts:155–158` 의 `BUTTON_NODE_TYPES` Set 정의를 바꾸어도 이 주석이 자동으로 갱신되지 않는다. 타입 목록을 주석에 하드코딩하면 drift 위험이 있다.
- **제안**: 타입 열거를 주석에서 제거하고 "적용 대상은 `isButtonNodeType()` 참조"로만 기술.

---

### **[INFO]** spec 문서의 마이그레이션 노트가 스크립트 경로를 하드코딩
- **위치**: `spec/3-workflow-editor/4-ai-assistant.md` — "워크플로우 조립 규칙" 행 끝 추가 문단
- **상세**: `backend/scripts/migrate-button-ids.ts` 경로가 spec 문서에 직접 기재되어 있다. 스크립트가 이동되거나 이름이 바뀌면 spec이 stale해진다. spec 문서는 "backfill 마이그레이션 스크립트가 제공된다"는 사실만 기술하고 경로는 스크립트 자체의 JSDoc에 위임하는 것이 maintenance 부담이 적다.
- **제안**: 경로 직접 기재 대신 "서버 측 backfill 스크립트(`scripts/migrate-button-ids.ts`)로 … " → "서버 측 일회성 backfill 마이그레이션 스크립트로 …" 로 경로를 간접 표현하거나, 링크(`../../backend/scripts/migrate-button-ids.ts`) 형태로 변경해 깨진 링크로 즉시 감지 가능하게.

---

### **[INFO]** `button-slug.util.ts` 모듈 레벨 문서가 `resolve-dynamic-ports.ts` 연관성만 언급
- **위치**: `button-slug.util.ts:1–27` — 파일 상단 JSDoc
- **상세**: "마이그레이션" 섹션이 `migrate-button-ids.ts`를 언급하지만, 이 util이 `shadow-workflow.ts`에서도 호출된다는 사실이 문서에 없다. 진입점이 두 곳(shadow + migrate)인 것을 독자가 grep 없이 알 수 없다.
- **제안**: 모듈 JSDoc에 "호출 지점: shadow-workflow.ts (add_node / update_node 시 자동 정규화), migrate-button-ids.ts (일회성 backfill)" 한 줄 추가.

---

## 요약

6개 파일에 걸친 F-2 buttons[*].id 자동 부여 구현은 **전반적으로 문서화 품질이 양호하다**. 파일 상단 JSDoc, 마이그레이션 배경 설명, spec 업데이트가 모두 동반되어 있으며 인라인 주석도 핵심 로직(2-pass reserve, idempotency, edge 안정성 보장)을 충실히 설명한다. 다만 몇 가지 개선 여지가 있다: 롤백 절차 미기재(운영 리스크), spec 내 경로 하드코딩(drift 위험), `uniqueSlug` 절단 동작의 미묘한 엣지케이스 미기술, 모듈 호출 지점 누락. 이 중 어느 것도 즉시 동작을 깨트리지는 않으며, 모두 낮은 우선순위의 maintenance 개선 사항이다.

## 위험도

**LOW**