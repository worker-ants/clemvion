---
id: "CLE-ENG"
title: "개발 규약"
type: "area"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-VISION"
ancestors: ["CLE-VISION"]
area: null
content_hash: "9aa986280a3f04ee2b4704e6a2dadbb0d33e968b67380ee5872ea5c2217fc88e"
read_as: "approved_fallback"
task: "CLE-T-RGZBCQ"
source_paths: []
mirror_sha256: "5a7d074af0ecafa56e8845fa53eb6fdcac2777a3bdfa30656cfcc2d2962a64c8"
etag: "sha256-b0cf9c75f68d4d9c76bcef4c70d606c7b9027cbc8ae6519ba721cac1078c0096"
---
> 구현 상태: 구현됨 · 원문: 없음(영역 문서) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

개발 규약 영역은 **제품 동작을 정하지 않는다.** 사용자가 보는 화면·API·실행 결과는 다른 영역이 정한다. 이 영역은 개발자가 코드를 쓰는 방식, DB 스키마를 바꾸는 방식, Redis 키 이름을 짓는 방식, 스펙·사용자 가이드·리뷰 산출물을 관리하는 방식을 정한다. 대상은 코드·저장소·문서의 운영 방식이다.

규칙 대부분은 CI 나 빌드 가드가 강제한다. 가드가 닿지 않는 규칙은 코드 리뷰에서 사람이 본다. 문서마다 어느 규칙을 기계가 막고 어느 규칙을 사람이 보는지 함께 적는다.

작업 절차·명령·테스트 인프라·역할 체계는 저장소 루트의 `CLAUDE.md`·`PROJECT.md` 와 `.claude/**` 하네스 문서가 정한다. 이 영역의 문서와 그 파일이 겹치는 곳은 각 문서가 밝힌다.

[스펙과 구현 근거 규약](CLE-ENG-SPECEVIDENCE.md) 과 [리뷰 산출물 인용 규약](CLE-ENG-REVIEWCITE.md) 은 스펙이 저장소 `spec/` 파일이고 리뷰 산출물이 `review/**` 에 커밋된다는 전제 위에서 만들어졌다. 전환 단계 1 부터 스펙의 정본은 NERV 문서이고 저장소 `spec/` 은 읽기 전용 미러다. 전환 단계 5 에서 옛 스펙 트리를 지워 저장소 `spec/` 에는 미러만 남았다. 전환 단계 2 부터 리뷰 결과는 NERV 리뷰 레코드이고 저장소에 커밋하지 않는다. 옛 `review/**` 는 전환 단계 3 에서 지웠다. 바뀐 전제는 두 문서의 "NERV 이전 영향" 절에 모았다.

API 응답 형식·에러 코드·OpenAPI 문서화처럼 제품 표면에 닿는 규약은 [API 공통 규약](../CLE-API/CLE-API.md) 영역에, 화면 문구와 다국어 규약은 [앱 셸과 공통 화면](../CLE-UI/CLE-UI.md) 영역에 있다.

## 문서

| 문서 | 다루는 것 |
| --- | --- |
| [프론트엔드 레이어 규약](CLE-ENG-FRONTEND.md) | 프론트엔드 디렉터리의 의존 방향(`app → components → lib → types`), ESLint 가드가 막는 범위와 한계, 가드가 살아 있는지 확인하는 테스트 |
| [DB 마이그레이션 규약](CLE-ENG-MIGRATION.md) | Flyway 채택과 실행 방식, V번호 정책, append-only, `outOfOrder=false`, 머지 race 를 막는 여러 단계의 안전망 |
| [Redis 키 명명 규약](CLE-ENG-REDIS.md) | `{도메인}:{용도}[:{식별자}...]` 형태, 워크스페이스 세그먼트를 넣는 기준, 새 키 등재 의무, Redis 키가 아닌 인접 이름. 키 목록은 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 에 있다 |
| [raw SQL 결과 읽기 규약](CLE-ENG-RAWQUERY.md) | `UPDATE`/`DELETE … RETURNING` 이 튜플이라는 것과 raw 결과 컬럼이 snake_case 라는 것, 이를 개수로 강제하는 발견형 가드 |
| [스펙과 구현 근거 규약](CLE-ENG-SPECEVIDENCE.md) | 스펙 본문 `## 구현 위치` 와 그 경로의 실재를 보는 빌드 가드(`spec-impl-locations`), 스펙 문서 저장소 무결성 가드(링크 · 도구 태그 잔재), 코드 속 스펙 언급 가드(옛 경로 래칫 · 키 언급), 코드 주석의 키 링크, NERV 이전으로 바뀐 전제. 옛 frontmatter(`status` · `code:` · `pending_plans:`)와 상태 라이프사이클, plan 무결성 가드는 전환 단계 3 · 5 에서 걷었다 |
| [리뷰 산출물 인용 규약](CLE-ENG-REVIEWCITE.md) | 코드 주석이 리뷰를 가리키는 형식(옛 산출물은 날짜 필수, 새 리뷰는 NERV 발견 전체 ID)과 적용 범위, 응답 DTO JSDoc 가드, 줄인 발견 ID 와 로컬 `.review/**` 경로를 막는 가드(`review-citation-form`), NERV 리뷰 레코드 전환으로 바뀐 전제 |
| [사용자 가이드 근거 규약](CLE-ENG-GUIDEEVIDENCE.md) | 가이드가 약속한 화면·API 가 코드에 있는지 빌드에서 확인하는 `<ImplAnchor>` 와 가드 3건 |
