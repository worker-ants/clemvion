## 발견사항

### [INFO] 멀티라인 주석 블록 — CLAUDE.md 정책 위반
- **위치**: `information-extractor.handler.ts` (CONVENTIONS Principle 7 주석 6줄), `truncate-body.util.ts` (PRESENTATION_MAX_BYTES JSDoc, `truncateArrayForOutput` JSDoc), `ai-agent.handler.ts` (`buildMultiTurnConfigEcho` JSDoc)
- **상세**: CLAUDE.md 규약("Never write multi-paragraph docstrings or multi-line comment blocks — one short line max")을 위반. 해당 WHY는 plan 문서에 이미 기록됐으며, 코드에 중복 서술하지 않아도 됨.
- **제안**: 각 주석을 "CONVENTIONS Principle 7 — raw echo, not engine-resolved." 수준의 한 줄로 압축하거나 제거.

### [INFO] `truncateArrayForOutput`의 크로스-카테고리 임포트
- **위치**: `carousel.handler.ts:7`, `table.handler.ts:12` → `integration/_base/truncate-body.util.js` 임포트
- **상세**: Presentation 노드가 `integration/_base/` 유틸리티를 직접 임포트. 기능적으로는 무해하고 plan에서 이 위치를 명시했지만, 향후 `presentation/_base/` 등 전용 위치로 분리할 여지가 있음. 현재 범위에서는 허용된 결정.
- **제안**: 무시하거나 추후 `shared/` 레이어 생성 시 이동 고려.

### [INFO] `rendered` HTML과 `items`/`rows` 간 잠재적 크기 불일치
- **위치**: `carousel.handler.ts:168-188`, `table.handler.ts:136-154`
- **상세**: `rendered`는 캡 적용 전 전체 items/rows로 생성된 후 payload에 넣는 반면, `items`/`rows`는 1MB로 잘림. 예를 들어 6개 × 200KB 아이템의 경우 `output.items`는 ~5개지만 `output.rendered`는 6개 전체 HTML을 담음(~1.2MB). spec이 이를 의도적으로 허용("rendered는 cap 대상 아님")하고 있으므로 범위 이탈은 아니나, 실제로 rendered가 items/rows보다 더 커지는 상황이 발생함.
- **제안**: 현재 spec 결정 존중. 다만 추후 DB JSONB 사이즈 이슈 발생 시 rendered에도 별도 cap 도입 필요.

---

### 요약

두 follow-up(AI Agent rawConfig plumbing, Carousel/Table 1MB cap) 모두 계획된 범위 내에서만 수정됐다. 무관한 파일 수정, 불필요한 리팩토링, 요청 외 기능 확장은 없다. 발견된 이슈는 전부 멀티라인 주석 정책 위반(INFO)이거나 이미 spec에서 의도적으로 결정된 설계 트레이드오프(INFO)에 해당한다. 기능적 회귀 위험도는 없으며, 테스트도 각 변경에 대응하여 적절히 보강됐다.

### 위험도
**LOW**