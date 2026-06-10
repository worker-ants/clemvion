# 신규 식별자 충돌 검토 — spec/2-navigation/5-knowledge-base.md

## 발견사항

### 발견사항 없음 (NONE)

target 문서가 이번 변경에서 새로 도입하는 식별자는 다음과 같다.

| 식별자 | 종류 | 신규 여부 |
|--------|------|-----------|
| `R-3` (Rationale) | 섹션 레이블 | 신규 추가 |
| "검색 불가 배너" / 상세 상단 배너 개념 | UI 컴포넌트 명칭 | 신규 명명 |
| `POST /api/knowledge-bases/:id/re-embed` (배너 CTA 재사용) | API endpoint | 기존 재사용 |
| `reembedStatus` / `embeddingDimension` | DTO 필드 | 기존 필드 재사용 |
| `KB_REEMBED_IN_PROGRESS` | 에러 코드 | 기존 재사용 |
| `EMBEDDING_PROBE_FAILED` | 에러 코드 | 기존 재사용 |

#### 1. 요구사항 ID 충돌

target 문서는 요구사항 ID(`NAV-*`, `ND-*` 등)를 새로 부여하지 않는다.
`R-1` / `R-2` / `R-3` 는 각 spec 파일 내부 로컬 레이블이다(`spec/2-navigation/` 하위 모든 파일이 독립적으로 R-1, R-2, R-3 를 가진다). `5-knowledge-base.md` 의 R-3 는 동일 파일의 R-1, R-2 와 순번이 연속하므로 충돌 없다.

#### 2. 엔티티/타입명 충돌

새로 언급된 명칭인 "검색 불가 배너" 는 문서 내 서술 명칭이며, 코드 상 컴포넌트 명칭이 아직 부여되지 않았다. 기존 코드베이스(`codebase/frontend/src/`) 에 `UnsearchableBanner`, `ReembedBanner` 등의 명칭이 이미 쓰이고 있지 않아 충돌 없다.

`reembedStatus` / `embeddingDimension` 은 `spec/1-data-model.md §2.11`, `spec/5-system/8-embedding-pipeline.md`, `spec/5-system/9-rag-search.md` 에서 이미 동일 의미로 사용 중이며 target 이 재사용·정렬한 것이다. 의미 충돌 없다.

#### 3. API endpoint 충돌

`POST /api/knowledge-bases/embedding-probe` 와 `POST /api/knowledge-bases/:id/re-embed` 모두 `spec/2-navigation/5-knowledge-base.md §3` 에 기존 등록된 엔드포인트이며, target 변경은 배너 CTA 가 기존 `POST /re-embed` 를 **재사용**한다고 명시한다. 신규 API 없음.

`spec/data-flow/6-knowledge-base.md` 에도 `POST /api/knowledge-bases/embedding-probe` 가 동일 의미로 정의되어 있어 일관성 충돌 없다.

#### 4. 이벤트/메시지명 충돌

target 문서는 신규 WS/SSE/queue 이벤트 이름을 도입하지 않는다. `document:embedding_retry` 등 기존 이벤트를 참조만 한다.

#### 5. 환경변수·설정키 충돌

신규 ENV var / config key 없음.

#### 6. 파일 경로 충돌

target 은 `spec/2-navigation/5-knowledge-base.md` 로 기존 파일의 수정이다. 신규 파일 경로 없음.

---

## 요약

target 문서(`spec/2-navigation/5-knowledge-base.md`)가 이번 변경(§2.4.1 검색 불가 배너 + R-3 추가)에서 도입하는 식별자는 모두 기존 식별자의 재사용이거나 파일 내부 로컬 레이블이다. 신규 API 엔드포인트, 에러 코드, DTO 필드, 이벤트 이름, 환경변수는 없다. Rationale R-3 는 동일 파일의 R-1/R-2 순번을 자연스럽게 이어받으며, 타 파일의 R-3 는 모두 파일 로컬 레이블이므로 교차 충돌이 발생하지 않는다. 식별자 충돌 위험 없음.

## 위험도

NONE
