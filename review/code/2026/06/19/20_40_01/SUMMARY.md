# AI Review SUMMARY — agent-memory model fields → select

**대상**: `git diff origin/main...HEAD` (feat: 메모리 모델 필드 select 위젯 + spec/docs).
**리뷰어**: maintainability / side-effect / requirement+spec-match / testing / user-guide-sync
(5종, bg 세션 bgIsolation 으로 reviewer 는 텍스트 반환 + main 이 본 SUMMARY 기록).

## 전체 위험도: LOW (Critical 0)

| reviewer | risk | 결과 |
| --- | --- | --- |
| maintainability | NONE | Info 만 (apiKey="" 인라인 주석 등) |
| side-effect | LOW | WidgetProps.config 무해·읽기전용·3개소 정합 확인. config={value} 리렌더 Warning |
| requirement | LOW | **런타임 resolve 경로·spec 4문서 일치 PASS**. Warning 2 = 인지된 trade-off |
| testing | MEDIUM | 테스트 격리 + 엣지 3종 누락 |
| user-guide-sync | WARNING | AI Agent 가이드 FieldTable 에 embeddingModel 행 부재 |

## 조치 분류

### FIX (본 리뷰 턴에 조치)
1. **[user-guide-sync W]** ai.mdx/ai.en.mdx AI Agent 섹션 FieldTable 에 `embeddingModel` 행 추가
   (KO/EN). IE 섹션엔 있으나 AI Agent 섹션엔 부재한 기존 갭 — 같은 표를 type 갱신으로
   손대는 김에 해소.
2. **[testing W]** model-selector-widgets.test.tsx 보강:
   - 테스트 격리: `chatConfigs` 를 공유 beforeEach 로 리셋 (describe 간 누수 차단)
   - 엣지: stale llmConfigId → default fallback / 빈 configs → provider="" / 비문자열 value → ""
   - (Info) baseUrl passthrough 단언 + stub data-base-url 노출
3. **[maintainability I]** model-selector-widgets.tsx apiKey="" 인라인 주석 보강

### NO-FIX (근거 기록)
- **[side-effect W] config={value} 매 keystroke 리렌더**: SchemaForm 은 controlled form 이라
  값 변경 시 **모든 위젯이 이미 리렌더**된다 — config prop 이 신규 리렌더를 도입하지 않는다.
  combobox 는 React Query(staleTime 30s) 캐시 공유라 재요청 0. 실질 비용 무의미.
  prop 을 string 으로 좁히는 대안은 widget-specific 지식을 SchemaForm 에 누설해 부적절.
- **[side-effect I] backend UiHint.widget 의 multiselect 누락**: 본 PR 이전부터 있던 부채
  (origin/main 동일), 본 변경 무관. 별도 PR 대상.

### DEFER (follow-up — spec 약속 surface 아님, 신규 i18n/디자인 필요)
- **[requirement W] 삭제된/미존재 llmConfigId silent fallback**: 위젯이 다른 provider 모델을
  보여줄 수 있음. "연결 LLM config 없음" 시각 경고는 §12.12 범위 밖 방어적 UX.
- **[requirement W] chat 연결에 embedding 모델 부재 시 빈 목록**: plan 리스크에 기인지. "이 연결은
  임베딩 모델 미제공, 비우면 워크스페이스 기본" 안내 후속.
- **[requirement I] expression 저장값(`{{ }}`)이 saved-fallback 으로 노출**: 선택 시 리터럴로
  호출 실패 가능. `{{ }}` 감지 경고 오버레이 후속.
→ plan/in-progress/agent-memory-model-select.md 의 follow-up 에 등록.

## 런타임·spec 일치 (requirement reviewer 검증 PASS)
- chat(summary/extraction)·embedding 모두 위젯 config 소스(llmConfigId) = 런타임 resolve config 일치.
- fallback 체인·저장 형태(모델명 문자열) 무변경 → 하위호환 100%.
- spec 4문서(§2.6.2 21종, ai-agent §1+§12.12, IE §1, 17-agent-memory §3) ↔ 구현 일치.
</content>
