# 신규 식별자 충돌 분석 결과

## 발견사항

### 요구사항 ID 충돌

해당 없음. 본 변경은 새로운 요구사항 ID를 신설하지 않는다. `V-02` 는 기존 cross-audit 항목 식별자로, `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 에서 이미 정의·사용 중인 번호이며, 이번 변경은 해당 항목을 해소·완료로 표시하는 것이다.

---

### **[WARNING]** `spec/2-navigation/13-user-guide.md` frontmatter 코드 경로가 삭제된 파일을 참조

- **target 신규 식별자**: (삭제 변경) `ai-configs.tsx` 파일을 codebase 에서 제거
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/ai-node-override-fields/spec/2-navigation/13-user-guide.md` line 115
  ```yaml
  code: ["codebase/backend/src/nodes/ai/**", "codebase/frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx"]
  ```
- **상세**: `ai-configs.tsx` 는 이번 diff 에서 완전 삭제됐다. 그러나 `spec/2-navigation/13-user-guide.md` 의 frontmatter `code:` 배열이 해당 경로를 아직 참조하고 있다. 이 frontmatter 는 spec-impl 커버리지 도구가 파싱하므로, 도구가 해당 경로에서 구현 증거를 찾으려 할 때 false negative(파일 없음 → 미이행 오진) 를 유발할 수 있다.
- **제안**: `spec/2-navigation/13-user-guide.md` line 115 의 `code:` 배열에서 `"codebase/frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx"` 항목을 제거하고, 필요하다면 `auto-form/schema-form.tsx` 또는 `node-configs/override-registry.ts` 로 대체한다.

---

### 엔티티/타입명 충돌

해당 없음. 이번 변경이 도입하는 새 식별자는 테스트 파일의 `describe`/`it` 문자열뿐이다. `OVERRIDE_REGISTRY` 상수는 기존에 이미 정의됐으며, 이번 diff 는 그 내용에서 항목 두 개를 제거하는 것이다. `TextClassifierConfig`, `InformationExtractorConfig` 컴포넌트는 삭제된 것이지 신설된 것이 아니다.

---

### API endpoint 충돌

해당 없음. 본 변경은 frontend 렌더 트랙 변경이며 새 API endpoint 를 도입하지 않는다.

---

### 이벤트/메시지명 충돌

해당 없음.

---

### 환경변수·설정키 충돌

해당 없음.

---

### 파일 경로 충돌

- 신규 파일: `codebase/frontend/src/components/editor/settings-panel/node-configs/__tests__/override-registry.test.ts`
  - 기존 `__tests__/` 디렉터리 하위에 신설되는 테스트 파일이며, 동명 파일 없음 (신규 생성). 충돌 없음.
- 삭제 파일: `codebase/frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx`
  - 위 WARNING 항목에서 다룬 spec frontmatter 참조 잔류 외 추가 충돌 없음.

---

## 요약

이번 변경(V-02 해소)은 새로운 식별자를 거의 도입하지 않는다. 핵심 동작은 기존 `OVERRIDE_REGISTRY` 에서 `text_classifier`·`information_extractor` 항목을 제거하고 `ai-configs.tsx` 를 삭제하는 것이다. CRITICAL 수준의 식별자 충돌은 없다. 단, `spec/2-navigation/13-user-guide.md` frontmatter `code:` 배열이 삭제된 `ai-configs.tsx` 경로를 계속 참조하고 있어, spec-impl 커버리지 도구가 해당 경로에서 구현 증거를 찾을 때 오진이 발생할 수 있다. 이 참조를 제거하거나 대체 경로로 갱신하는 것을 권장한다.

## 위험도

LOW
