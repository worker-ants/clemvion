# Rationale 연속성 검토 결과

## 발견사항

### [WARNING] spec §2.6.3 "override 잔존" 목록이 구현과 불일치
- **target 위치**: `codebase/frontend/src/components/editor/settings-panel/node-configs/override-registry.ts` — `text_classifier`, `information_extractor` 를 OVERRIDE_REGISTRY 에서 제거 (auto-form 이행)
- **과거 결정 출처**: `spec/3-workflow-editor/1-node-common.md §2.6.3` "override 잔존" 목록 (line 274) — `text_classifier`, `information_extractor` 가 명시적으로 override 잔존 노드로 열거되어 있음
- **상세**: 구현(diff)은 `text_classifier`·`information_extractor` 를 OVERRIDE_REGISTRY 에서 삭제해 auto-form 트랙으로 이행했고, 테스트 코드(`override-registry.test.ts`)의 주석도 "bespoke forms 폐기" 를 설명한다. 그러나 spec §2.6.3 의 "override 잔존" 목록에는 두 노드가 여전히 남아 있어 spec ↔ 구현이 역전된 상태다. 한편 `ai_agent` 는 §2.6.3 "auto-form 이행 완료" 목록에 이미 반영돼 있으므로, `text_classifier`·`information_extractor` 의 동일 이행이 목록 갱신 없이 누락된 것이다. spec §2.6.3 의 이행 기준("cross-field side effect 등 auto-form 표현력 밖의 요구가 남은 노드")에 따라 두 노드를 제거했다면, 그 근거(zod schema 가 `conversation-context · agent-memory · field-array examples/enumValues` 를 충분히 노출해 bespoke 폼이 불필요해졌다)를 spec Rationale 에 새로 추가하고 §2.6.3 목록을 갱신해야 한다. 현 상태는 "결정 번복이 의도된 것 같으나 새 Rationale 및 목록 갱신 부재" 에 해당.
- **제안**: `spec/3-workflow-editor/1-node-common.md §2.6.3` 의 "auto-form 이행 완료" 목록에 `text_classifier`·`information_extractor` 를 추가하고, "override 잔존" 목록에서 두 노드를 제거한다. 동시에 `## Rationale` 에 "V-02 cross-audit: text_classifier·information_extractor bespoke 폼 폐기 근거" 항을 신설해 — zod schema 의 ui hint 가 해당 노드의 전 필드를 커버하게 돼 bespoke 폼이 redundant 해진 사실 — 을 명문화한다.

---

### [WARNING] spec/2-navigation/13-user-guide.md 의 `code:` frontmatter 에 삭제된 파일 경로 잔존
- **target 위치**: `spec/2-navigation/13-user-guide.md` line 115 — `code: ["codebase/backend/src/nodes/ai/**", "codebase/frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx"]`
- **과거 결정 출처**: `spec/3-workflow-editor/1-node-common.md §2.6` (node-configs frontmatter 가 SoT 로 명시); `spec/3-workflow-editor/1-node-common.md` frontmatter `node-configs/**` 1곳 관리 원칙 (R-2)
- **상세**: diff 에서 `ai-configs.tsx` 가 삭제됐으나 `13-user-guide.md` 의 `code:` frontmatter 가 여전히 해당 경로를 가리킨다. 이는 dead 링크(파일 미존재)이며, spec R-2 의 "frontend 설정 UI 매핑을 `node-configs/**` · `auto-form/**` frontmatter 1곳에서 관리" 원칙과도 충돌 — user-guide spec 이 이행 완료된 bespoke 파일 경로를 참조 유지하는 것은 동기화 부재.
- **제안**: `spec/2-navigation/13-user-guide.md` line 115 의 `ai-configs.tsx` 경로를 `auto-form/schema-form.tsx` 로 교체하거나, AI 노드 렌더 경로가 `schema-form.tsx` 로 자동 처리됨을 반영하는 경로(`"codebase/frontend/src/components/editor/settings-panel/auto-form/**"`)로 수정한다. 이것이 바로 본 V-02 최종 커밋의 원래 목적(consistency W-1 해소)이므로 이미 수행됐어야 할 수정이다.

---

## 요약

target 변경(ai-configs.tsx 삭제, OVERRIDE_REGISTRY 에서 text_classifier·information_extractor 제거)은 `spec/3-workflow-editor/1-node-common.md §2.6` 의 "override → auto-form 이행" 설계 원칙 자체와는 일치하지만, §2.6.3 트랙 배정 현황 목록과 spec/2-navigation/13-user-guide.md 의 code frontmatter 가 갱신되지 않아 두 곳에서 spec ↔ 구현 역전이 남았다. 특히 §2.6.3 의 "override 잔존" 목록 갱신 누락은 Rationale R-2 가 명시한 "이 섹션을 SoT 로 단일 관리" 원칙 위반이며, 이행 결정의 근거(bespoke 폼이 redundant 해진 사유)를 Rationale 에 기록하지 않은 "결정 번복이 의도됐으나 새 Rationale 부재" 패턴에 해당한다. 기각·폐기된 대안의 재도입이나 invariant 직접 위반은 없으므로 CRITICAL 수준은 아니다.

## 위험도

MEDIUM
