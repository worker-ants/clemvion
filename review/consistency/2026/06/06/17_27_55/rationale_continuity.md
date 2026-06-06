# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
검토 범위: `spec/5-system/14-external-interaction-api.md` (구현 변경 사항 기준)
실제 변경: `codebase/backend/test/execution-park-resume.e2e-spec.ts`, `docker-compose.e2e.yml`

---

## 발견사항

### [INFO] DB 직접 INSERT → 정식 API 경로로 전환 — Rationale 신규 추가 권장

- **target 위치**: `codebase/backend/test/execution-park-resume.e2e-spec.ts` L567–587 (변경 후)
- **과거 결정 출처**: `PROJECT.md §e2e 테스트 작성 가이드 "알려진 우회"` (L296–299) — DB 직접 INSERT 가 허용되는 케이스를 "초대 가입 사용자 JWT 401 우회" 와 "invite throttle 우회" 두 케이스로만 명시 열거. `spec/5-system/14-external-interaction-api.md` Rationale 내 별도 e2e 패턴 언급 없음.
- **상세**: 변경 전 코드는 `ENCRYPTION_KEY` 가 32-char(16byte) 로 세팅되어 `crypto.util.encrypt` (AES-256, 32byte 요구)와 길이 불일치가 발생해 `POST /api/llm-configs` 가 500을 반환했고, 이를 DB 직접 INSERT 로 우회했다. 변경 후 코드는 `docker-compose.e2e.yml` 의 `ENCRYPTION_KEY` 를 64-hex(32byte) 로 교정하고, 정식 `POST /api/llm-configs` API 경로를 e2e 로 커버한다. 이는 기각된 대안의 재도입이 아니라 오히려 **DB 직접 INSERT 우회를 폐기하고 정식 경로로 복귀**한 긍정적 변화다. PROJECT.md `"알려진 우회"` 섹션의 DB 직접 INSERT 허용 패턴 목록에는 이 케이스가 원래부터 없었고, 변경 후에도 없으므로 목록 변경이 필요 없다. 단, 변경 이유("crypto.util 경로 e2e 커버를 위해 64-hex 로 세팅")가 코드 주석과 docker-compose 주석에는 기술됐으나 spec 또는 관련 Rationale 에는 기록되지 않았다.
- **제안**: `spec/5-system/14-external-interaction-api.md` 의 `## Rationale` (현재 없음 — spec 상태 `partial`) 또는 `PROJECT.md §e2e 테스트 작성 가이드` 에 "llm-config API key 암호화 경로(`crypto.util.encrypt`)는 `ENCRYPTION_KEY=64-hex` 환경에서 e2e 정식 API 경로로 커버한다 — DB 직접 INSERT 우회는 해당 없음"을 INFO 수준 메모로 추가하면 추후 동일 케이스에서 동일 실수 재발을 방지할 수 있다. 필수 수정 아님.

---

## 요약

본 변경(exec-park B2a follow-up)은 `execution-park-resume.e2e-spec.ts` 에서 `llm_config` DB 직접 INSERT 우회를 제거하고 정식 `POST /api/llm-configs` API 경로를 e2e 로 커버하도록 교정한 것이며, 그 전제로 `docker-compose.e2e.yml` 의 `ENCRYPTION_KEY` 를 AES-256 요구 길이(32byte=64-hex) 에 맞게 교정했다. 이는 `PROJECT.md §"알려진 우회"` 가 명시 열거한 DB 직접 INSERT 허용 케이스 목록에 해당하지 않으며, 기존 Rationale 의 어떤 기각 대안도 재도입하지 않았다. 오히려 초기 구현이 암호화 키 길이 불일치라는 환경 결함을 DB 우회로 숨겼던 것을 정식 API 경로로 복귀시킨 정합성 강화다. spec Rationale 관련 문서 중 이 변경과 직접 충돌하는 과거 결정은 발견되지 않았다.

---

## 위험도

NONE
