---
id: "CLE-UI"
title: "앱 셸과 공통 화면"
type: "area"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-VISION"
ancestors: ["CLE-VISION"]
area: null
content_hash: "bab82c9b770d5188661cb1aa9b240640de0b2ec48bc87f098eb2d490d63b99d0"
read_as: "approved"
task: null
source_paths: []
mirror_sha256: "2c1324b4731c673128f0e89fd48801f6456e98af599d75f648dcfa14a79677ce"
etag: "sha256-39930dd04edab68b71099d944ca293e9c1bda281d225bded2abb66e573c1ce48"
---
> 구현 상태: 구현됨 · 원문: 없음(영역 문서) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

앱 셸과 공통 화면 영역은 로그인한 사용자가 보는 모든 화면이 공유하는 틀을 다룬다. 제품의 내비게이션은 왼쪽 사이드바가 중심이고, 메뉴 항목마다 독립 화면으로 바뀐다. 워크플로우 에디터는 목록에서 워크플로우를 고르면 들어가는 별도 화면이다.

이 영역은 레이아웃과 사이드바, 워크스페이스 슬러그 라우팅, 여러 화면이 함께 쓰는 UI 패턴, 전체 화면 오류와 빈 상태, 앱 안 사용자 가이드, 화면 문구의 다국어 규약, 브랜드를 정한다. 각 화면의 내용은 그 기능 영역이 정한다. 예를 들어 워크플로우 목록은 [워크플로우 작성](../CLE-WF/CLE-WF.md), 실행 내역은 [실행](../CLE-EXEC/CLE-EXEC.md) 영역에 있다.

## 문서

| 문서 | 다루는 것 |
| --- | --- |
| [레이아웃과 내비게이션](CLE-UI-LAYOUT.md) | 앱 레이아웃, 사이드바 메뉴와 동작, 워크스페이스 슬러그 라우팅, 메인 영역과 공통 헤더, 목록·상세 패널·상태 표시·인라인 안내·반응형·테마 같은 공통 UI 패턴 |
| [오류 화면과 빈 상태](CLE-UI-ERRORS.md) | 전체 화면 오류 다섯 가지와 감지 규칙, 화면별 빈 상태, 검색 결과 없음 |
| [사용자 가이드](CLE-UI-GUIDE.md) | 앱 안 사용자 가이드(`/docs`)의 정보 구조·라우트·파일 형식·딥링크·접근과 표시·빌드 검증 |
| [다국어와 화면 문구](CLE-UI-I18N.md) | 화면 문구 사전과 ko/en 동등성, 백엔드 라벨 매핑, 가이드 문체 규칙과 동반 갱신 규율 |
| [마켓플레이스 (구상)](CLE-UI-MARKET.md) | 아직 구현하지 않은 마켓플레이스의 방향 스케치. 구현 약속이 아니다 |
| [브랜드](CLE-UI-BRAND.md) | 제품명 표기, 브랜드 스토리, 로고·색·타이포그래피, 어조 |
