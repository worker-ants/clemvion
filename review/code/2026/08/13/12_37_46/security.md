# 보안(Security) 리뷰

## 발견사항

없음.

본 변경분은 실질적으로 **문서·주석 정정 diff**이며, 실행 가능한 로직 변경이 없다.

- `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts`: `MINUTE_WINDOW_SEC`/`HOUR_WINDOW_SEC` 상수 위의 docstring 2줄만 "슬라이딩 윈도우" → "fixed-window (`EXPIRE ... NX`)" 로 정정한 것으로, 로직(`incrWithWindow`, `consumeStart`, pipeline `INCR`+`EXPIRE NX` 등)은 이전 그대로다. rate-limit 알고리즘 자체(신뢰할 수 없는 IP 헤더 sentinel 처리 `UNIDENTIFIED_IP_BUCKET`, fail-open 정책 등)에 대한 코드 수정은 없다.
- `plan/in-progress/backend-lint-gate-broken-on-main.md`: 체크리스트 항목을 완료로 표시하고 근거 서술을 추가한 작업 추적 문서. 보안 표면 없음.
- `spec/4-nodes/4-integration/4-cafe24.md`: 기존 §9.8 Rationale 안에 있던 Cafe24 install nonce(`cafe24:install:nonce:*`, TTL 10분, replay 방지)·실패 카운터(`cafe24:install:fail:*`, `INSTALL_FAIL_THRESHOLD=10`, `INSTALL_FAIL_WINDOW_SEC=600`, fail-open) Redis 키 표를 신설 §4.4(본문, normative)로 승격 이동한 것. 표 내용(용도·TTL·degradation)은 §9.8 원문과 동일하며 새 보안 정책·임계값 변경은 없다. §9.8 은 HMAC 검증 알고리즘·설계 근거 서술을 그대로 유지(삭제 없이 포인터만 §4.4 로 조정).
- `spec/5-system/15-chat-channel.md`: CCH-SE-02 요구사항 행에서 구현 상세(Redis `SET NX EX 30`, 키 포맷 `cc:dedup:<triggerId>:<idempotencyKey>`)를 제거하고 `data-flow/14 §2.2`(SoT) 참조로 축약. dedup 요구사항 자체(30초 재도착 무시, Redis 미가용 시 fail-open)는 문구 그대로 보존되어 정책 변경 없음. 순수 이중 SoT 제거(문서 구조 정리).
- `spec/conventions/redis-keys.md`: Cafe24 키 인벤토리 행의 상세 SoT 링크를 `§9.8` → `§4.4` 로 갱신한 것으로 파일 3의 이동에 따른 앵커 동기화일 뿐, 키 형태·소유 모듈 변경 없음.

점검 관점(인젝션·하드코딩 시크릿·인증/인가·입력 검증·OWASP Top 10·암호화·에러 처리·의존성 보안) 전체에 대해 이번 diff 범위 안에서 새로 도입되거나 변경된 취약 요소는 없다. Cafe24 install endpoint 의 HMAC 검증·nonce replay 방지·IP 실패 카운터 rate-limit 설계 자체는 코드 변경 없이 문서 위치만 재배치됐으므로 기존 설계의 안전성 판단(이미 다른 세션에서 검증된 부분)은 이번 리뷰의 대상이 아니다.

## 요약

이번 changeset 은 5개 파일 모두 코드 로직 변경이 없는 **주석/문서 정정(스펙 구조 재배치 포함)** 이다. 유일한 소스 코드 파일(`public-webhook-quota.service.ts`)도 docstring 2줄만 "슬라이딩 윈도우" 표기를 실제 동작(`fixed-window`)에 맞게 정정했을 뿐 `INCR`+`EXPIRE NX` pipeline 로직, fail-open 정책, IP sentinel 처리 등 보안에 영향을 주는 어떤 실행 경로도 바뀌지 않았다. spec 문서 변경들도 Cafe24 install nonce/rate-limit Redis 키 표와 chat-channel dedup 요구사항의 SoT 위치를 재배치한 것뿐이며 값·정책·알고리즘은 원문 그대로 보존됐다. 신규 인젝션·시크릿 하드코딩·인증/인가 우회·입력검증 누락·암호화 약화·에러 메시지 정보노출·취약 의존성 등 어떤 항목에도 해당하는 변경이 없다.

## 위험도

NONE
