"""src.models.admin
Admin 계정. bcrypt 해시 비번.
"""
from datetime import datetime
from sqlalchemy import String, BigInteger, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from src.core.database import Base


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)
