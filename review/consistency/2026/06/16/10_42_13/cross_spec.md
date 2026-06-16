# Cross-Spec 일관성 검토 결과

**Target**: `spec/2-navigation/6-config.md`
**검토 모드**: spec draft (`--spec`)
**검토 일시**: 2026-06-16

---

## 발견사항

### [INFO] SSRF 예외 규칙 참조 표현 — `tei`/`local` 병기 혼동 가능성
- **target 위치**: R-4 (`spec/2-navigation/6-config.md` 마지막 Rationale 섹션)
- **충돌 대상**: `spec/5-system/7-llm-client.md §4.1` (RerankClientFactory), `spec/5-system/7-llm-client.md §5.5` (SSRF 가드)
- **상세**: R-4 에서 "SSRF 가드 자체는 `tei`/`local` 예외 규칙 재사용" 이라고 기술한다. `llm-client.md §4.1` 은 동일 맥락에서 "SSRF 가드는 자가호스팅 `tei` 만 사설망을 허용하며(rerank 에는 `local` provider 가 없다 — §2.1 Dropped), §5.5 의 `tei`/`local` 예외 규칙을 재사용한다"라고 쓰고, 모순 없이 두 spec 이 모두 "chat §5.5 의 `local` 예외 코드패스를 재사용하되, rerank 맥락에서는 `tei` 만 사설망 허용"임을 설명하고 있다. 따라서 실질적 충돌은 없으나, `6-config.md` R-4 의 "`tei`/`local` 예외 규칙 재사용"이라는 표현만 보면 rerank 에도 `local` 예외가 있는 것처럼 오해할 수 있다.
- **제안**: R-4 의 해당 문구를 "SSRF 가드 자체는 [LLM Client §5.5] 의 `tei`/`local` 예외 규칙 코드패스를 재사용(단, rerank 맥락에서 실제 허용 provider 는 `tei` 뿐 — `local` 리랭커는 §2.1 Dropped)"과 같이 명시하면 `llm-client.md §4.1` 의 설명과 표현 수준을 맞출 수 있다.

---

### [INFO] Model Config API 권한 기술 차이 — "Editor+" vs "mutation(POST/PATCH/DELETE)"
- **target 위치**: `§3 Model Config API` 표 위 설명 ("mutation (POST / PATCH / DELETE) 은 Editor+")
- **충돌 대상**: `spec/5-system/1-auth.md §3.2` 권한 매트릭스 (Model Config = Owner/Admin/Editor = CRUD, Viewer = R)
- **상세**: target 은 Model Config mutation 을 "Editor+" 로 기술하고, `1-auth.md §3.2` 도 Model Config = Editor CRUD 로 일치한다. 단, 같은 문서의 Authentication API 에서 mutation 을 "Admin+" 로 명시한 것과 대조되어 독자가 혼동할 가능성이 있다. 기술 자체는 충돌하지 않는다.
- **제안**: 두 API 섹션이 나란히 놓이므로 Model Config API 설명에 "(Spec 인증 §3.2)" 참조 링크를 추가해 두 권한 수준의 의도적 차이가 설계 결정임을 명시하면 좋다.

---

## 요약

`spec/2-navigation/6-config.md` 는 다른 spec 영역(`spec/1-data-model.md §2.16·§2.17`, `spec/5-system/1-auth.md §3.2`, `spec/5-system/7-llm-client.md §4.1·§5.5`, `spec/5-system/12-webhook.md`)과 데이터 모델·API 계약·권한 매트릭스 면에서 실질적 모순이 없다. ModelConfig 단일 테이블·kind 판별·is_default 유니크 스코프·마스킹 정책·SSRF 가드·RBAC(Auth Config Admin+ / Model Config Editor+) 모두 타 spec 과 정합한다. 발견된 항목은 표현 수준의 명확성 개선 건(INFO 2건)에 그치며 채택을 차단하는 충돌은 없다.

## 위험도

NONE
