# 신규 식별자 충돌 검토 — spec/2-navigation/ (--impl-done)

## 발견사항

### 발견사항 없음 — 신규 식별자 모두 충돌 없음

이 브랜치(`kb-reembed-banner-impl-31d0c8`)가 `spec/2-navigation/` 영역에서 도입한 신규 식별자는 다음과 같다.

**구현 신규 식별자**

| 식별자 | 종류 | 위치 |
|--------|------|------|
| `UnsearchableBanner` | React 컴포넌트 | `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx` |
| `unsearchable-banner` | 파일명 | 동일 |
| `reembedNow` | i18n key | `knowledgeBases.reembedNow` (en + ko dict) |
| `unsearchableBannerIdleDesc` | i18n key | `knowledgeBases.unsearchableBannerIdleDesc` |
| `unsearchableBannerInProgressDesc` | i18n key | `knowledgeBases.unsearchableBannerInProgressDesc` |

**spec 변경 식별자** (`spec/2-navigation/4-integration.md` diff)

- 이 브랜치의 diff 는 Rationale 텍스트 수정(makeshop → "나머지 3종"으로 표현 변경)뿐이며, 새 ID·엔티티명·endpoint·이벤트명을 도입하지 않는다.

---

### 각 항목별 충돌 여부

#### 1. 요구사항 ID 충돌

`spec/2-navigation/5-knowledge-base.md` 의 `id: knowledge-base` 는 저장소 전체에서 유일하다(`grep -rh "^id:"` 전수 확인). `spec/2-navigation/4-integration.md` 의 `id: integration` 도 마찬가지. **충돌 없음.**

#### 2. 엔티티/타입명 충돌

- `UnsearchableBanner` — origin/main 포함 저장소 전체에 동명 컴포넌트·타입이 없다. **충돌 없음.**
- `unsearchable-banner.tsx` — `git ls-tree -r origin/main --name-only`로 확인, 해당 파일명 없음. **충돌 없음.**

#### 3. API endpoint 충돌

이 브랜치가 도입한 spec 변경(`spec/2-navigation/4-integration.md`)은 기존 Rationale 텍스트 수정뿐이다. `spec/2-navigation/5-knowledge-base.md` §2.4.1 의 **"신규 API 없음"** 선언(기존 `POST /api/knowledge-bases/:id/re-embed` 재사용)도 origin/main 기준 변경 없다. **충돌 없음.**

#### 4. 이벤트/메시지명 충돌

신규 이벤트·WebSocket·큐 메시지명 없음. **충돌 없음.**

#### 5. 환경변수·설정키 충돌

신규 ENV var 없음. **충돌 없음.**

#### 6. 파일 경로 충돌

`codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx` 는 신규 파일로 origin/main 에 없었다. 명명 컨벤션(`<feature-slug>.tsx`, kebab-case) 은 동일 디렉터리의 기존 파일들(`embedding-test-button.tsx`, `graph-3d-renderer.tsx` 등)과 일치한다. **충돌 없음.**

---

### 참고 — 기존 i18n 키와의 관계

`reembeddingRequired`, `reembeddingInProgress` 두 키는 origin/main 에 이미 존재하며 KB 목록 카드(`knowledge-bases/page.tsx`)에서 사용 중이다. 이 브랜치는 이 키들을 **재사용**하고 신규 키를 추가하는 구조이므로 중복 도입이 아니다. 신규 세 키(`reembedNow`, `unsearchableBannerIdleDesc`, `unsearchableBannerInProgressDesc`)는 origin/main 에 없었으며 KB 상세 배너(`unsearchable-banner.tsx`) 전용으로 명확하게 네임스페이스가 구분된다.

---

### INFO — 4-integration.md 내부 표현 불일치 (pre-existing, 이 브랜치 도입 아님)

- **INFO** spec/2-navigation/4-integration.md §4.6(line 378)·§9.3(line 816)의 기존 설명은 여전히 "makeshop 도 동일(`services/makeshop/catalog`)" 및 "`:type='cafe24'` 및 `:type='makeshop'` 만 operations 반환" 으로 기술하는 반면, 이 브랜치가 수정한 Rationale 절은 "cafe24 만 catalog 라벨"로 기술한다.
  - target 신규 식별자: 이 브랜치 diff 에서 Rationale 표현을 cafe24 단독으로 수정
  - 기존 사용처: `spec/2-navigation/4-integration.md` line 378, line 816 (origin/main 에서 동일, 이 브랜치에서 미수정)
  - 상세: §4.6·§9.3 기술과 Rationale 기술 간 "makeshop catalog 지원 여부"가 상충하나, 이 불일치는 origin/main 에 이미 존재했다. 실제 구현(`integrations.service.ts:getServiceCatalog`)은 makeshop 을 빈 배열로 반환하며, Rationale 수정 내용과 일치한다. **이 브랜치가 새로 도입한 충돌이 아님** — pre-existing 불일치이므로 별도 후속 정리 권장.
  - 제안: 후속 PR 에서 §4.6 line 378 의 "makeshop 도 동일" 부분과 §9.3 line 816 의 `초기 응답 정책` 항목에서 makeshop 언급을 제거하거나 "향후 지원 가능성" 주석으로 전환한다. 본 PR 범위 밖.

---

## 요약

이 브랜치(`spec/2-navigation/` --impl-done)가 도입한 신규 식별자(`UnsearchableBanner`, `unsearchable-banner.tsx`, `reembedNow`, `unsearchableBannerIdleDesc`, `unsearchableBannerInProgressDesc`)는 어느 관점(요구사항 ID, 엔티티명, API endpoint, 이벤트명, ENV var, 파일 경로)에서도 기존 사용처와 충돌하지 않는다. `spec/2-navigation/4-integration.md` Rationale 수정도 새 식별자를 도입하지 않는다. 발견된 INFO 항목(§4.6·§9.3 makeshop catalog 기술 잔존)은 origin/main 에 이미 존재하던 pre-existing 표현 불일치로 이 브랜치의 신규 도입 충돌이 아니다.

## 위험도

NONE
