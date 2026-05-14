필요한 파일들을 모두 확인했습니다. 분석을 완료합니다.

---

## 발견사항

### **[WARNING]** W1 — `categories.join(', ')` 타입 불일치
- **target 위치**: 제안 §1 (W1) — `text_classifier` final assistant text 변환 규칙
- **위반 규약**: `spec/4-nodes/3-ai/2-text-classifier.md` §5.2 출력 구조
- **상세**: `spec/4-nodes/3-ai/2-text-classifier.md` §5.2 에서 `output.result.categories` 의 타입은 `Array<{name, confidence?, evidence?}>` (객체 배열) 이다. 제안된 `output.result.categories.join(', ')` 는 JS에서 `[object Object], [object Object]` 를 생성하며, 개발자가 이를 그대로 구현하면 ConversationThread 에 의미 없는 문자열이 push된다.
- **제안**: `output.result.categories.map(c => c.name).join(', ')` 로 수정하거나, "각 카테고리 `name` 필드를 쉼표로 조합" 으로 서술 변경.

---

### **[WARNING]** W4 — §4.4 anchor 누락 (링크 깨짐)
- **target 위치**: 제안 §4 (W4) — blockquote 내 markdown 링크
- **위반 규약**: 정식 규약 교차 링크 신뢰성 (CLAUDE.md spec 문서 품질 기준)
- **상세**: 제안된 텍스트의 링크가 `[노드 output 규약 §4.1 / §4.4](./node-output.md#41-상태-전이)` 형태인데, 두 섹션을 단일 anchor `#41-상태-전이` 에 연결한다. `node-output.md §4.4` 의 실제 heading 은 `### 4.4. Resumed 상태의 \`output\` 내용` 이므로 anchor 는 별도(`#44-resumed-상태의-output-내용`)다. 현재 링크로는 §4.4 에 도달할 수 없다.
- **제안**: `[§4.1](./node-output.md#41-상태-전이) / [§4.4](./node-output.md#44-resumed-상태의-output-내용)` 로 분리.

---

### **[WARNING]** W5 — `result.content` 용어가 기존 규약과 불일치
- **target 위치**: 제안 §5 (W5) — step 2.5 두 번째 bullet
- **위반 규약**: `spec/conventions/conversation-thread.md` §2.2 AI Agent push 컨트랙트
- **상세**: 제안된 step 2.5 의 "최종 `result.content` (json 모드는 stringified)" 라는 표현이 conversation-thread.md §2.2 에서 명시한 `output.result.response` 와 다른 용어를 사용한다. `result.content` 는 LLM provider raw 응답의 내부 필드명처럼 읽히며, 핸들러 output spec 기준으로는 `output.result.response` 가 단일 진실이다.
- **제안**: "최종 `output.result.response` (responseFormat=json 시 stringified)" 로 통일.

---

### **[WARNING]** W6 — `output.rendered` 를 chart 에도 적용 — Principle 4.3 과 불일치
- **target 위치**: 제안 §6 (W6) — 대체 표 행 중 `output.rendered (template/chart)` 부분
- **위반 규약**: `spec/conventions/node-output.md` Principle 4.3 "Waiting 상태의 output (노드별)"
- **상세**: Principle 4.3 표에서 chart 의 Waiting output 은 `{ data }` 로만 정의되어 있고 `output.rendered` 가 없다. 반면 `output.rendered` 는 template 전용 필드다. 제안의 `output.rendered (template/chart)` 는 chart 에도 `rendered` 가 있는 것처럼 오기하여 다운스트림 워크플로우 작성자가 `$node["Chart"].output.rendered` 를 참조했다가 `undefined` 를 얻는 혼동을 야기한다. Principle 4.2 의 `output.rendered (HTML snapshot)` 메모는 chart 가 아닌 현재 구현의 모든 presentation 노드를 대상으로 한 검토 항목이다.
- **제안**: `output.rendered (template)` 로 수정하고 chart 를 별도로 `output.data (chart)` 행으로만 표기 (현재 제안에 이미 있음).

---

### **[INFO]** W3 — em dash가 포함된 anchor 의 렌더링 안정성
- **target 위치**: 제안 §3 (W3) — cross-reference `./conversation-thread.md#53-cap-v1--char-기반`
- **위반 규약**: 없음 (스타일 제안)
- **상세**: 링크 anchor 에 `—` (em dash) 가 `--` 로 표기되어 있는데, CommonMark의 heading-to-anchor 변환에서 em dash는 환경에 따라 `-`, `--`, 또는 완전 제거로 처리될 수 있다. 기능적으로 현재 환경에서는 작동 가능하지만 안정성 확인이 필요하다.
- **제안**: 실제 렌더된 anchor 를 확인하거나, heading 을 `### 5.3 Cap` 으로 단순화해 anchor 를 `#53-cap` 으로 정리하는 것도 고려.

---

## 요약

총 6건 중 5건(W2, W3 대부분, W4~W6 일부)은 전반적으로 규약의 의도에 부합하는 보강안이다. 그러나 **W1** 의 `categories.join(', ')` 는 타입 불일치로 구현 오류를 유발할 수 있고, **W5** 의 `result.content` 는 spec 내 용어 일관성을 깨며, **W6** 의 `output.rendered (template/chart)` 는 Principle 4.3 과 충돌한다. **W4** 의 markdown anchor 오류는 문서 탐색을 방해한다. 네 WARNING 은 채택 전 수정 권장.

## 위험도

**LOW** — CRITICAL 위반은 없으며, 발견된 WARNING 4건은 모두 1~2줄 수정으로 해소 가능하다. 즉시 spec write 차단 필요 없음.