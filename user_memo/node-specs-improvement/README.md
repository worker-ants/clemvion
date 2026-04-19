# 노드 Output 변수 일관성 개선안

현 `user_memo/node-specs/` 문서를 기준으로 각 노드의 `output` / `meta` / `port` / `status` 구조를 전수 조사한 결과를 토대로, **일관성 있는 네이밍과 구조 규칙**을 제안하고, 그 규칙에 맞추어 각 노드별 마이그레이션 방안을 정리한 문서입니다.

> 본 문서는 **설계 제안**입니다. 구현된 상태가 아닙니다. 실제 변경 시 엔진 / 핸들러 / 프런트엔드 / 기존 워크플로우 expression의 하위 호환을 반드시 고려하세요.

---

## 문서 구성

- **[CONVENTIONS.md](./CONVENTIONS.md)** — 모든 개선안이 공유하는 전역 규칙 (Principle 1~11). 각 노드 문서는 이 규칙을 참조합니다.
- **[INCONSISTENCY_MATRIX.md](./INCONSISTENCY_MATRIX.md)** — 현 상태의 불일치를 축 단위(네이밍 / 중첩 깊이 / 에러 / 재개 / 메타)로 나열한 요약표.
- **카테고리별 노드 디렉토리** — `trigger/`, `logic/`, `flow/`, `ai/`, `integration/`, `data/`, `presentation/` 하위에 노드별 개선안 1개씩.

## 각 노드 개선안의 구조

모든 노드 개선 문서는 다음 섹션을 동일한 순서로 갖습니다.

1. **현재 Output 구조 요약** — 현 문서에서 추출한 실제 shape
2. **식별된 불일치** — `CONVENTIONS.md`의 Principle N번 참조
3. **제안된 Output 구조** — `Before` / `After` JSON 비교
4. **마이그레이션 영향도** — Breaking / Non-breaking 표기와 expression 경로 변경 목록
5. **근거 / 참고** — 왜 이렇게 바꾸는가

## 작업 우선순위 (요약)

**P0 (Breaking, 즉시 검토)**:
- `information_extractor` 의 `output.output.extracted.*` 이중 중첩 제거 → `output.result.extracted.*`
- Multi-turn 재개 컨트랙트 통합 (`ai_agent`, `information_extractor` vs `form`, `carousel`)
- 에러 컨트랙트 통일 (runtime error → `port:'error'` + `output.error`)

**P1 (Usability)**:
- LLM 응답 필드 통일 (`response` / `category` / `extracted` → `output.result.*`)
- 토큰/실행 메트릭 위치 통일 (항상 `meta.*`, `output.metadata` 폐지)
- Container 노드 `output` 오버라이트 컨트랙트 명문화

**P2 (Style)**:
- 동적 포트 네이밍 규칙 (`__item_${idx}` suffix 공식화)
- Config echo 규칙 (credentials 제외, URL 내 토큰 sanitize)
- 빈 입력 fallback 정책 (`[]` / `{}` 통일)
