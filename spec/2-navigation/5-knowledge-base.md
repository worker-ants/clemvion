# Spec: 지식 저장소 화면

> 관련 문서: [PRD 내비게이션](../../prd/1-navigation.md#35-knowledge-base) · [PRD 통합/연동](../../prd/4-integration.md#3-knowledge-base) · [Spec 레이아웃](./0-layout.md) · [데이터 모델 - KnowledgeBase](../1-data-model.md#211-knowledgebase)

---

## 1. 화면 구조

```
┌──────────────────────────────────────────────────────────────┐
│  Knowledge Base                   [+ New Collection]        │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 📚 Customer Support FAQ                                  ││
│  │    12 documents · 2,340 chunks · ✅ Ready         ⋮     ││
│  ├──────────────────────────────────────────────────────────┤│
│  │ 📚 Product Manual                                        ││
│  │    5 documents · 890 chunks · 🔄 Processing (2/5) ⋮     ││
│  ├──────────────────────────────────────────────────────────┤│
│  │ 📚 Internal Policies                                     ││
│  │    3 documents · 450 chunks · ✅ Ready             ⋮     ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 기능 상세

### 2.1 컬렉션 목록

| 요소 | 설명 |
|------|------|
| 컬렉션 이름 | 클릭 시 컬렉션 상세 화면으로 이동 |
| 문서 수 | 포함된 문서 개수 |
| 청크 수 | 생성된 벡터 청크 총 개수 |
| 임베딩 상태 | Ready(✅) / Processing(🔄 + 진행률) / Error(❌) |
| 더보기(⋮) | 설정, 삭제 |

### 2.2 컬렉션 생성

| 필드 | 설명 |
|------|------|
| 이름 | 컬렉션 이름 (필수) |
| 설명 | 컬렉션 설명 (선택) |
| 임베딩 모델 | 사용할 임베딩 모델 선택 (LLMConfig 연동) |
| 청크 크기 | 문서 분할 청크 크기 (기본: 1000 토큰) |
| 청크 오버랩 | 청크 간 오버랩 (기본: 200 토큰) |

### 2.3 컬렉션 상세 화면 (문서 관리)

```
┌──────────────────────────────────────────────────────────────┐
│  ← Knowledge Base / Customer Support FAQ                     │
│                                          [Upload Documents]  │
│                                                              │
│  ┌──────────────────┐                                        │
│  │ 🔍 Search docs.. │                                        │
│  └──────────────────┘                                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 📄 faq-general.md          MD    45KB   ✅ Ready     ⋮  ││
│  │ 📄 faq-billing.pdf         PDF   1.2MB  ✅ Ready     ⋮  ││
│  │ 📄 faq-technical.txt       TXT   23KB   🔄 Processing⋮  ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### 2.4 문서 항목

| 요소 | 설명 |
|------|------|
| 파일 아이콘 | 파일 유형별 아이콘 |
| 파일 이름 | 클릭 시 미리보기 패널 |
| 파일 유형 | MD / PDF / TXT / CSV |
| 파일 크기 | 표시 |
| 임베딩 상태 | Ready / Processing / Error |
| 더보기(⋮) | 미리보기, 재임베딩, 삭제 |

### 2.5 문서 업로드

- "**Upload Documents**" 버튼 또는 드래그 앤 드롭
- 지원 형식: .txt, .md, .pdf, .csv
- 다중 파일 동시 업로드 지원
- 업로드 후 자동으로 벡터 임베딩 시작
- 업로드 진행률 표시

### 2.6 문서 미리보기

- 우측 슬라이드 패널로 문서 내용 표시
- PDF: 페이지별 렌더링
- 텍스트/Markdown: 렌더링된 내용 표시
- 생성된 청크 목록 확인 (청크별 내용 미리보기)

---

## 3. API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/knowledge-bases | 컬렉션 목록 조회 |
| POST | /api/knowledge-bases | 컬렉션 생성 |
| GET | /api/knowledge-bases/:id | 컬렉션 상세 조회 |
| PATCH | /api/knowledge-bases/:id | 컬렉션 설정 수정 |
| DELETE | /api/knowledge-bases/:id | 컬렉션 삭제 |
| GET | /api/knowledge-bases/:id/documents | 문서 목록 조회 |
| POST | /api/knowledge-bases/:id/documents | 문서 업로드 (multipart) |
| GET | /api/knowledge-bases/:id/documents/:docId | 문서 상세/미리보기 |
| DELETE | /api/knowledge-bases/:id/documents/:docId | 문서 삭제 |
| POST | /api/knowledge-bases/:id/documents/:docId/re-embed | 재임베딩 요청 |
