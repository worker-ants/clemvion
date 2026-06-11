# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)
대상 영역: `spec/2-navigation/` (범위: KB 상세 배너 리팩터링)
diff-base: `origin/main`

---

## 변경 범위 요약

이번 변경은 `UnsearchableBanner` 컴포넌트의 순수 내부 리팩터링이다.

| 파일 | 변경 내용 |
|------|-----------|
| `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx` | `Props` → `UnsearchableBannerProps` 개명, `reembedStatus` 타입을 `KnowledgeBaseData["reembedStatus"]` 파생으로 변경, 상태별 JSX 분기를 `STATE_CONFIG` 룩업 테이블로 추출 |
| `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` | 호출부 주석 확장 (배너와 진행 박스의 데이터 출처가 의도적으로 다름을 명시) |
| `codebase/frontend/src/components/knowledge-base/__tests__/unsearchable-banner.test.tsx` | 테스트 추가/갱신 |

---

## 발견사항

### 발견사항 없음 — 6개 관점 모두 이상 없음

#### 1. 데이터 모델 충돌 — 없음

- `reembedStatus` 의 허용값은 `"idle" | "in_progress"` 이며, 이는 다음 세 소스가 모두 일치한다.
  - `spec/1-data-model.md §2.11` KnowledgeBase 엔티티의 `reembed_status` Enum 정의 (`idle` / `in_progress`)
  - Backend DTO: `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts:34` (`'idle' | 'in_progress'`)
  - Frontend API 타입: `codebase/frontend/src/lib/api/knowledge-bases.ts:30` (`"idle" | "in_progress"`)
- 신규 컴포넌트에서 `type ReembedStatus = KnowledgeBaseData["reembedStatus"]` 로 파생한 타입 역시 동일한 union 이다. 데이터 모델에 새 상태값을 추가하지 않았으며 모든 소스가 일치한다.

#### 2. API 계약 충돌 — 없음

- 이번 변경은 API 호출부에 영향을 주지 않는다. `onReembed` 핸들러는 호출부(`[id]/page.tsx`)에 위임되어 있으며, `spec/2-navigation/5-knowledge-base.md §3 API`의 `POST /api/knowledge-bases/:id/re-embed` 경로·동작은 변경되지 않았다.
- 응답 DTO shape(`reembedStatus` 필드 포함) 도 변경 없음.

#### 3. 요구사항 ID 충돌 — 없음

- 이번 커밋은 신규 요구사항 ID를 부여하지 않는다. 기존 spec(`spec/2-navigation/5-knowledge-base.md §2.4.1 · R-3`)이 정의한 배너 동작(idle CTA 표시, in_progress CTA 숨김, RoleGate(editor) 적용)을 그대로 보존하며, 구현 형태만 리팩터링한 것이다.

#### 4. 상태 전이 충돌 — 없음

- `UnsearchableBanner`는 `reembedStatus` 를 외부에서 주입받는 순수 표시 컴포넌트다. 상태 전이 로직(`idle → in_progress`)은 백엔드 엔진 및 호출부 WS 구독에 있으며 이번 변경에 포함되지 않는다.
- `STATE_CONFIG` 구조는 `idle`·`in_progress` 두 키를 빠짐없이 포함하는 exhaustive Record 이므로, 상태값이 추가되면 컴파일 타임에 누락이 강제 감지된다 — 상태 기계와의 일관성이 오히려 강화되었다.

#### 5. 권한·RBAC 모델 충돌 — 없음

- 이번 변경은 RBAC 규칙을 변경하지 않는다.
- `RoleGate(minRole="editor")` 는 기존 그대로 유지된다 — spec `§2.4.1`의 "비-editor 는 배너 텍스트만 표시(버튼 없음)" 규칙이 보존된다.
- `STATE_CONFIG.idle.showCta = true` / `STATE_CONFIG.in_progress.showCta = false` 는 spec의 "in_progress 에서 CTA 숨김" 정책(`R-3`)을 테이블로 명시화한 것이며, 권한 정책을 변경하지 않는다.

#### 6. 계층 책임 충돌 — 없음

- 컴포넌트는 `codebase/frontend/src/components/knowledge-base/` 하위에 유지된다.
- 호출부(`page.tsx`)가 게이트(`kb.embeddingDimension == null`) 조건과 `onReembed` 핸들러를 여전히 책임지며, 배너는 순수 표시 책임만 갖는 기존 계층 분리가 보존된다.
- `KnowledgeBaseData` 타입을 `@/lib/api/knowledge-bases` 에서 import 하는 것은 프론트엔드 내부 의존성으로, 기존 레이어 경계를 침범하지 않는다.

---

## 요약

이번 변경은 `UnsearchableBanner` 컴포넌트를 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 어디도 건드리지 않는 순수 내부 리팩터링이다. `reembedStatus` 타입을 `KnowledgeBaseData["reembedStatus"]` 에서 파생함으로써 향후 상태값 확장 시 컴파일 타임 보호가 오히려 강화되었고, 6개 Cross-Spec 검토 관점 모두에서 기존 spec과의 충돌이 없다.

---

## 위험도

NONE
